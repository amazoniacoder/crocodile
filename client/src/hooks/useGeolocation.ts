import { useState, useCallback, useEffect } from 'react';

interface Location {
  id: number;
  name: string;
  latitude: string;
  longitude: string;
}

interface IpGeoResult {
  latitude: number;
  longitude: number;
  city: string;
}

function distanceSq(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return (lat1 - lat2) ** 2 + (lon1 - lon2) ** 2;
}

function findNearestCity(lat: number, lon: number, locations: Location[]): Location | null {
  if (!locations.length) return null;
  return locations.reduce((best, loc) => {
    const d = distanceSq(lat, lon, Number(loc.latitude), Number(loc.longitude));
    const dBest = distanceSq(lat, lon, Number(best.latitude), Number(best.longitude));
    return d < dBest ? loc : best;
  });
}

async function detectByIp(): Promise<IpGeoResult | null> {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.latitude || !data.longitude) return null;
    return { latitude: data.latitude, longitude: data.longitude, city: data.city ?? '' };
  } catch {
    return null;
  }
}

export type GeoStatus = 'idle' | 'loading' | 'detected' | 'failed';

export function useGeolocation(locations: Location[]) {
  const [cityId, setCityId] = useState<number | null>(null);
  const [detectedCity, setDetectedCity] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<GeoStatus>('idle');
  // permission оставляем для обратной совместимости с WeatherWidget
  const [permission, setPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  const detect = useCallback(async () => {
    if (!locations.length) return;
    setLoading(true);
    setStatus('loading');
    const geo = await detectByIp();
    setLoading(false);
    if (!geo) {
      setStatus('failed');
      setPermission('denied');
      return;
    }
    const nearest = findNearestCity(geo.latitude, geo.longitude, locations);
    if (nearest) {
      setDetectedCity(nearest);
      setStatus('detected');
      setPermission('granted');
    } else {
      setStatus('failed');
      setPermission('denied');
    }
  }, [locations]);

  const confirm = useCallback(() => {
    if (detectedCity) setCityId(detectedCity.id);
    setDetectedCity(null);
  }, [detectedCity]);

  const dismiss = useCallback(() => {
    setDetectedCity(null);
    setStatus('failed');
  }, []);

  // Автоопределение при первой загрузке городов
  useEffect(() => {
    if (locations.length > 0 && status === 'idle') {
      detect();
    }
  }, [locations.length]);

  return { cityId, detectedCity, loading, status, permission, detect, confirm, dismiss };
}
