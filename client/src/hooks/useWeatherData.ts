import { useEffect, useRef, useState } from 'react';
import type { WeatherForecast, WeatherLocation, HourlyRow } from '@/types/weather';
import { getCachedWeek, saveWeekToCache } from '@/services/weatherCache';
import type { HourlyForecast as DbHourlyForecast } from '@/services/weatherDb';
import { toDateStr } from '@/utils/weather';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

function mapApiHourly(raw: any[]): HourlyRow[] {
  return (raw ?? []).map(h => ({
    date:          h.date,
    time:          h.time,
    temp:          h.temp          ?? null,
    apparentTemp:  h.apparentTemp  ?? null,
    weatherCode:   h.weatherCode   ?? null,
    windSpeed:     h.windSpeed     ?? null,
    windGusts:     h.windGusts     ?? null,
    windDirection: h.windDirection ?? null,
    precipitation: h.precipitation ?? null,
    pressureHpa:   h.pressureHpa   ?? null,
  }));
}

function mapDbHourlyToRow(h: DbHourlyForecast): HourlyRow {
  return {
    date: h.date, time: h.time, temp: h.temp,
    apparentTemp:  h.apparentTemp ?? null,
    weatherCode: h.weatherCode, windSpeed: h.windSpeed,
    windGusts: h.windGusts,
    windDirection: h.windDirection, precipitation: h.precipitation,
    pressureHpa: h.pressureHpa,
  };
}

interface UseWeatherDataResult {
  locations:         WeatherLocation[];
  locLoading:        boolean;
  forecasts:         WeatherForecast[];
  weekHourly:        HourlyRow[];
  loading:           boolean;
  isRefreshing:      boolean;
  weekBundlePending: boolean;
  dataSource:        'network' | 'cache' | 'indexeddb';
  selectedId:        number | null;
  setSelectedId:     (id: number | null) => void;
}

const STORAGE_KEY = 'weather:selected-city';
const LOCATIONS_KEY = 'weather:locations';

export function useWeatherData(): UseWeatherDataResult {
  const isOnline   = useOnlineStatus();
  const wasOffline = useRef(false);

  const [locations, setLocations]     = useState<WeatherLocation[]>([]);
  const [locLoading, setLocLoading]   = useState(true);
  const [selectedId, setSelectedIdState] = useState<number | null>(() => {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? parseInt(s) : null;
  });
  const [forecasts, setForecasts]               = useState<WeatherForecast[]>([]);
  const [weekHourly, setWeekHourly]             = useState<HourlyRow[]>([]);
  const [loading, setLoading] = useState(() => {
    // Если есть selectedId — сразу показываем скелетон, не ждём эффекта
    const s = localStorage.getItem(STORAGE_KEY);
    return !!s;
  });
  const [isRefreshing, setIsRefreshing]         = useState(false);
  const [weekBundlePending, setWeekBundlePending] = useState(false);
  const [dataSource, setDataSource]             = useState<'network' | 'cache' | 'indexeddb'>('network');

  const setSelectedId = (id: number | null) => setSelectedIdState(id);

  // Синхронизация с виджетом: реагируем на изменения в localStorage из другого компонента
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setSelectedIdState(parseInt(e.newValue));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    fetch('/api/weather/locations')
      .then(r => r.json())
      .then(d => {
        const locs = d.locations ?? [];
        setLocations(locs);
        setLocLoading(false);
        try { localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locs)); } catch { /* ignore */ }
        if (!selectedId && locs.length) {
          const moscow = locs.find((l: WeatherLocation) => l.name === 'Москва');
          setSelectedIdState(moscow?.id ?? locs[0].id);
        }
      })
      .catch(() => {
        // Офлайн: читаем локации из localStorage
        console.log('[Weather] locations fetch failed, trying localStorage cache');
        try {
          const cached = localStorage.getItem(LOCATIONS_KEY);
          if (cached) {
            const locs: WeatherLocation[] = JSON.parse(cached);
            console.log('[Weather] loaded locations from localStorage:', locs.length);
            setLocations(locs);
            if (!selectedId && locs.length) {
              const moscow = locs.find(l => l.name === 'Москва');
              const fallbackId = moscow?.id ?? locs[0].id;
              console.log('[Weather] setting selectedId from localStorage locations:', fallbackId);
              setSelectedIdState(fallbackId);
            }
          } else {
            console.warn('[Weather] no locations in localStorage');
          }
        } catch (e) {
          console.error('[Weather] localStorage parse error:', e);
        }
        setLocLoading(false);
      });
  }, []);

  const applyCachedForecasts = (cached: NonNullable<Awaited<ReturnType<typeof getCachedWeek>>>) => {
    console.log('[Weather] applying cached forecasts, days:', cached.daily.length, 'hours:', cached.hourly.length);
    setDataSource('indexeddb');
    setForecasts(cached.daily.map(d => ({
      id: 0,
      forecastDate:                d.date,
      tempMin:                     d.tempMin?.toString()                     ?? null,
      tempMax:                     d.tempMax?.toString()                     ?? null,
      precipitationMm:             d.precipitationMm?.toString()             ?? null,
      precipitationProbabilityPct: d.precipitationProbabilityPct             ?? null,
      windSpeedKmh:                d.windSpeedKmh?.toString()                ?? null,
      windGustsKmh:                d.windGustsKmh?.toString()                ?? null,
      windDirectionDeg:            d.windDirectionDeg,
      humidityPct:                 d.humidityPct,
      pressureHpa:                 d.pressureHpa?.toString()                 ?? null,
      weatherCode:                 d.weatherCode,
      moonPhaseName:               d.moonPhaseName,
      moonPhase:                   d.moonPhase?.toString()                   ?? null,
      kpIndex:                     d.kpIndex?.toString()                     ?? null,
      kpLevel:                     d.kpLevel,
      uvIndexMax:                  d.uvIndexMax?.toString()                  ?? null,
    })));
    setWeekHourly(cached.hourly.map(mapDbHourlyToRow));
    setLoading(false);
  };

  useEffect(() => {
    if (!selectedId) {
      console.log('[Weather] selectedId is null, skipping fetch');
      return;
    }
    localStorage.setItem(STORAGE_KEY, String(selectedId));
    setLoading(true);
    console.log('[Weather] effect triggered, selectedId:', selectedId, 'isOnline:', isOnline);

    if (isOnline) {
      setWeekBundlePending(true);
      setWeekHourly([]);
      // Сначала показываем кэш пока идёт сетевой запрос
      getCachedWeek(selectedId).then(cached => { if (cached) applyCachedForecasts(cached); });

      setIsRefreshing(true);
      fetch(`/api/weather/week?locationId=${selectedId}`)
        .then(r => r.json())
        .then(d => {
          const list: WeatherForecast[] = (d.forecasts ?? []).map((f: any) => ({ ...f, moonPhase: f.moonPhase ?? null }));
          setForecasts(list);
          setWeekHourly(mapApiHourly(d.hourly ?? []));
          setDataSource('network');
          setLoading(false);
          setIsRefreshing(false);
          setWeekBundlePending(false);
          saveWeekToCache(selectedId, { location: d.location, forecasts: list, hourly: d.hourly ?? [] });
        })
        .catch(async (e) => {
          console.error('[Weather] online fetch failed:', e);
          // Сеть есть, но запрос упал — фоллбэк на кэш
          const cached = await getCachedWeek(selectedId, true);
          if (cached) applyCachedForecasts(cached);
          else setLoading(false);
          setIsRefreshing(false);
          setWeekBundlePending(false);
        });
      return;
    }

    console.log('[Weather] offline, calling getCachedWeek with offline=true, id:', selectedId);
    setWeekBundlePending(false);
    getCachedWeek(selectedId, true).then(cached => {
      console.log('[Weather] getCachedWeek result:', cached ? `${cached.daily.length} days` : 'null');
      if (cached) applyCachedForecasts(cached);
      else setLoading(false);
    });
  }, [selectedId, isOnline]);

  useEffect(() => {
    if (isOnline && wasOffline.current && selectedId) {
      setIsRefreshing(true);
      setWeekBundlePending(true);
      fetch(`/api/weather/week?locationId=${selectedId}`)
        .then(r => r.json())
        .then(d => {
          const list: WeatherForecast[] = (d.forecasts ?? []).map((f: any) => ({ ...f, moonPhase: f.moonPhase ?? null }));
          setForecasts(list);
          setWeekHourly(mapApiHourly(d.hourly ?? []));
          setDataSource('network');
          setIsRefreshing(false);
          setWeekBundlePending(false);
          saveWeekToCache(selectedId, { location: d.location, forecasts: list, hourly: d.hourly ?? [] });
        })
        .catch(() => { setIsRefreshing(false); setWeekBundlePending(false); });
    }
    wasOffline.current = !isOnline;
  }, [isOnline, selectedId]);

  return {
    locations, locLoading,
    forecasts, weekHourly,
    loading, isRefreshing, weekBundlePending,
    dataSource, selectedId, setSelectedId,
  };
}
