import { useEffect, useRef, useState } from 'react';
import type { HourlyRow } from '@/types/weather';
import { getCachedWeek } from '@/services/weatherCache';
import type { HourlyForecast as DbHourlyForecast } from '@/services/weatherDb';
import { toDateStr } from '@/utils/weather';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

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

interface UseHourlyDataParams {
  selectedId:        number | null;
  activeDate:        string | null;
  weekHourly:        HourlyRow[];
  weekBundlePending: boolean;
}

interface UseHourlyDataResult {
  hourly:        HourlyRow[];
  hourlyLoading: boolean;
}

export function useHourlyData({
  selectedId, activeDate, weekHourly, weekBundlePending,
}: UseHourlyDataParams): UseHourlyDataResult {
  const isOnline = useOnlineStatus();
  const [hourly, setHourly]               = useState<HourlyRow[]>([]);
  const [hourlyLoading, setHourlyLoading] = useState(false);
  const skeletonTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!selectedId || !activeDate) return;

    setHourlyLoading(true);
    const skeletonStartTime = Date.now();

    const dateStr    = toDateStr(activeDate);
    const nextDate   = new Date(dateStr);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toLocaleDateString('sv-SE');

    const hideSkeletonWithDelay = () => {
      const remaining = Math.max(0, 1000 - (Date.now() - skeletonStartTime));
      if (skeletonTimer.current) clearTimeout(skeletonTimer.current);
      skeletonTimer.current = setTimeout(() => setHourlyLoading(false), remaining);
    };

    const buildWindow = (rows: HourlyRow[]) => [
      ...rows.filter(h => h.date === dateStr),
      ...rows.filter(h => h.date === nextDateStr),
    ];

    const apply = (rows: HourlyRow[]) => {
      if (!rows.length) return false;
      setHourly(rows);
      hideSkeletonWithDelay();
      return true;
    };

    if (weekHourly.length > 0) {
      apply(buildWindow(weekHourly));
      return () => { if (skeletonTimer.current) clearTimeout(skeletonTimer.current); };
    }

    if (weekBundlePending) {
      getCachedWeek(selectedId, !isOnline).then(cached => {
        if (cached?.hourly.length) apply(buildWindow(cached.hourly.map(mapDbHourlyToRow)));
      });
      return () => { if (skeletonTimer.current) clearTimeout(skeletonTimer.current); };
    }

    getCachedWeek(selectedId, !isOnline).then(cached => {
      if (cached?.hourly.length && apply(buildWindow(cached.hourly.map(mapDbHourlyToRow)))) return;
      if (!isOnline) { hideSkeletonWithDelay(); return; }

      Promise.all([
        fetch(`/api/weather/hourly?locationId=${selectedId}&date=${dateStr}`).then(r => r.ok ? r.json() : { hours: [] }),
        fetch(`/api/weather/hourly?locationId=${selectedId}&date=${nextDateStr}`).then(r => r.ok ? r.json() : { hours: [] }),
      ]).then(([cur, nxt]) => {
        setHourly([
          ...(cur.hours ?? []).map((h: any) => ({ date: dateStr,     ...h })),
          ...(nxt.hours ?? []).map((h: any) => ({ date: nextDateStr, ...h })),
        ]);
        hideSkeletonWithDelay();
      }).catch(() => hideSkeletonWithDelay());
    });

    return () => { if (skeletonTimer.current) clearTimeout(skeletonTimer.current); };
  }, [selectedId, activeDate, isOnline, weekHourly, weekBundlePending]);

  return { hourly, hourlyLoading };
}
