import { weatherDb, WeatherLocation, DailyForecast, HourlyForecast } from './weatherDb';

const CACHE_TTL = 60 * 60 * 1000; // 1 час
const CACHE_TTL_OFFLINE = 24 * 60 * 60 * 1000; // 24 часа — для офлайн-режима
const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 дней

export interface CachedWeekData {
  location: WeatherLocation;
  daily: DailyForecast[];
  hourly: HourlyForecast[];
}

/**
 * Получить кэшированные данные на неделю для города
 */
export async function getCachedWeek(locationId: number, offline = false): Promise<CachedWeekData | null> {
  try {
    const now = Date.now();
    const ttl = offline ? CACHE_TTL_OFFLINE : CACHE_TTL;
    console.log('[WeatherCache] getCachedWeek id:', locationId, 'offline:', offline, 'ttl:', ttl / 60000, 'min');

    const location = await weatherDb.locations.get(locationId);
    if (!location) {
      console.warn('[WeatherCache] location not found in IDB for id:', locationId);
      return null;
    }
    const age = now - location.fetchedAt;
    // При офлайне не проверяем TTL — любые данные лучше пустого экрана
    if (!offline && age > ttl) {
      console.warn('[WeatherCache] location cache expired, age:', Math.round(age / 60000), 'min, ttl:', ttl / 60000, 'min');
      return null;
    }
    console.log('[WeatherCache] location ok, age:', Math.round(age / 60000), 'min', offline ? '(offline — TTL ignored)' : '');

    const daily = await weatherDb.daily
      .where('[locationId+date]')
      .between([locationId, ''], [locationId, '\uffff'])
      .toArray();

    if (daily.length === 0) {
      console.warn('[WeatherCache] no daily records in IDB');
      return null;
    }
    const dailyAge = now - daily[0].fetchedAt;
    if (!offline && dailyAge > ttl) {
      console.warn('[WeatherCache] daily cache expired, age:', Math.round(dailyAge / 60000), 'min');
      return null;
    }
    console.log('[WeatherCache] daily ok, count:', daily.length);

    const hourly = await weatherDb.hourly
      .where('locationId')
      .equals(locationId)
      .toArray();

    console.log('[WeatherCache] hourly count:', hourly.length);
    return { location, daily, hourly };
  } catch (err) {
    console.error('[WeatherCache] Failed to get cached week:', err);
    return null;
  }
}

/**
 * Сохранить данные недели в кэш
 */
export async function saveWeekToCache(
  locationId: number,
  data: {
    location: { id: number; name: string; country: string; timezone: string };
    forecasts: any[];
    hourly: any[];
  }
): Promise<void> {
  try {
    const now = Date.now();

    // Сохраняем локацию
    await weatherDb.locations.put({
      id: data.location.id,
      name: data.location.name,
      country: data.location.country,
      timezone: data.location.timezone,
      fetchedAt: now
    });

    // Сохраняем дневные прогнозы
    const dailyRecords: DailyForecast[] = data.forecasts.map(f => ({
      locationId,
      date:                        f.forecastDate,
      tempMin:                     f.tempMin ? Number(f.tempMin) : null,
      tempMax:                     f.tempMax ? Number(f.tempMax) : null,
      precipitationMm:             f.precipitationMm ? Number(f.precipitationMm) : null,
      precipitationProbabilityPct: f.precipitationProbabilityPct ?? null,
      windSpeedKmh:                f.windSpeedKmh ? Number(f.windSpeedKmh) : null,
      windGustsKmh:                f.windGustsKmh ? Number(f.windGustsKmh) : null,
      windDirectionDeg:            f.windDirectionDeg,
      humidityPct:                 f.humidityPct,
      pressureHpa:                 f.pressureHpa ? Number(f.pressureHpa) : null,
      weatherCode:                 f.weatherCode,
      moonPhase:                   f.moonPhase ? Number(f.moonPhase) : null,
      moonPhaseName:               f.moonPhaseName,
      kpIndex:                     f.kpIndex ? Number(f.kpIndex) : null,
      kpLevel:                     f.kpLevel,
      uvIndexMax:                  f.uvIndexMax ? Number(f.uvIndexMax) : null,
      fetchedAt:                   now
    }));

    await weatherDb.daily.bulkPut(dailyRecords);

    // Сохраняем почасовые данные
    const hourlyRecords: HourlyForecast[] = data.hourly.map(h => ({
      locationId,
      date:          h.date,
      time:          h.time,
      temp:          h.temp,
      apparentTemp:  h.apparentTemp ?? null,
      weatherCode:   h.weatherCode,
      windSpeed:     h.windSpeed,
      windGusts:     h.windGusts ?? null,
      windDirection: h.windDirection,
      precipitation: h.precipitation,
      pressureHpa:   h.pressureHpa,
      fetchedAt:     now
    }));

    await weatherDb.hourly.bulkPut(hourlyRecords);

    console.log(`[WeatherCache] Saved ${dailyRecords.length} days, ${hourlyRecords.length} hours for location ${locationId}`);
  } catch (err) {
    console.error('[WeatherCache] Failed to save week to cache:', err);
  }
}

/**
 * Очистить устаревшие данные (старше 7 дней)
 */
export async function clearOldCache(): Promise<{ deleted: number }> {
  try {
    const cutoff = Date.now() - MAX_AGE;
    
    const deletedLocations = await weatherDb.locations
      .where('fetchedAt')
      .below(cutoff)
      .delete();

    const deletedDaily = await weatherDb.daily
      .where('fetchedAt')
      .below(cutoff)
      .delete();

    const deletedHourly = await weatherDb.hourly
      .where('fetchedAt')
      .below(cutoff)
      .delete();

    const total = deletedLocations + deletedDaily + deletedHourly;
    
    if (total > 0) {
      console.log(`[WeatherCache] GC: deleted ${total} old records`);
    }

    return { deleted: total };
  } catch (err) {
    console.error('[WeatherCache] Failed to clear old cache:', err);
    return { deleted: 0 };
  }
}

/**
 * Очистить весь кэш погоды
 */
export async function clearAllWeatherCache(): Promise<void> {
  try {
    await weatherDb.locations.clear();
    await weatherDb.daily.clear();
    await weatherDb.hourly.clear();
    console.log('[WeatherCache] All weather cache cleared');
  } catch (err) {
    console.error('[WeatherCache] Failed to clear all cache:', err);
  }
}

/**
 * Получить размер кэша
 */
export async function getWeatherCacheSize(): Promise<{
  locations: number;
  daily: number;
  hourly: number;
  total: number;
}> {
  try {
    const locations = await weatherDb.locations.count();
    const daily = await weatherDb.daily.count();
    const hourly = await weatherDb.hourly.count();

    return {
      locations,
      daily,
      hourly,
      total: locations + daily + hourly
    };
  } catch (err) {
    console.error('[WeatherCache] Failed to get cache size:', err);
    return { locations: 0, daily: 0, hourly: 0, total: 0 };
  }
}
