import { logger } from '../../utils/logger';

export interface KpResult {
  kpIndex: number;
  kpLevel: string;
}

// 3-часовой официальный Kp-индекс NOAA
const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';

export async function getCurrentKpIndex(): Promise<KpResult | null> {
  try {
    const res = await fetch(KP_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;

    const data = await res.json() as Array<{ time_tag: string; Kp: number; a_running: number; station_count: number }>;
    if (!data?.length) return null;

    // Берём последнюю запись с ненулевым station_count (данные есть)
    const valid = [...data].reverse().find(e => e.station_count > 0 && e.Kp != null);
    if (!valid) return null;

    const kpIndex = valid.Kp;

    const kpLevel =
      kpIndex < 2 ? 'Спокойно' :
      kpIndex < 4 ? 'Слабое' :
      kpIndex < 5 ? 'Умеренное' :
      kpIndex < 6 ? 'Слабая буря' :
      kpIndex < 7 ? 'Умеренная буря' :
      kpIndex < 8 ? 'Сильная буря' :
      kpIndex < 9 ? 'Сильная буря+' : 'Экстремальная буря';

    return { kpIndex, kpLevel };
  } catch (err) {
    logger.warn('NOAA Kp-index fetch failed:', err);
    return null;
  }
}
