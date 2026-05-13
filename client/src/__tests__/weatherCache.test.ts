import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

import { weatherDb } from '../services/weatherDb';
import { getCachedWeek, saveWeekToCache, clearAllWeatherCache } from '../services/weatherCache';

beforeEach(async () => {
  await clearAllWeatherCache();
});

describe('weatherCache', () => {
  it('saveWeekToCache / getCachedWeek сохраняют дневные и почасовые записи', async () => {
    await saveWeekToCache(1, {
      location: { id: 1, name: 'Москва', country: 'Russia', timezone: 'Europe/Moscow' },
      forecasts: [
        {
          forecastDate: '2026-05-10',
          tempMin: '5',
          tempMax: '15',
          precipitationMm: '0',
          windSpeedKmh: '12',
          windDirectionDeg: 180,
          humidityPct: 40,
          weatherCode: 0,
          moonPhaseName: null,
          kpIndex: null,
          kpLevel: null,
        },
      ],
      hourly: [
        {
          date: '2026-05-10',
          time: '12',
          temp: 14,
          weatherCode: 0,
          windSpeed: 10,
          precipitation: 0,
        },
      ],
    });

    const cached = await getCachedWeek(1);
    expect(cached).not.toBeNull();
    expect(cached!.location.name).toBe('Москва');
    expect(cached!.daily).toHaveLength(1);
    expect(cached!.daily[0].date).toBe('2026-05-10');
    expect(cached!.hourly).toHaveLength(1);
    expect(cached!.hourly[0].time).toBe('12');

    const rawHourly = await weatherDb.hourly.toArray();
    expect(rawHourly).toHaveLength(1);
  });

  it('getCachedWeek возвращает null для устаревшего TTL локации', async () => {
    await weatherDb.locations.put({
      id: 2,
      name: 'Тест',
      country: 'Russia',
      timezone: 'Europe/Moscow',
      fetchedAt: Date.now() - 2 * 60 * 60 * 1000,
    });

    const stale = await getCachedWeek(2);
    expect(stale).toBeNull();
  });
});
