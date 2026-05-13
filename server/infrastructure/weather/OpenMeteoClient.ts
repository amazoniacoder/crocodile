import { logger } from '../../utils/logger';

const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_BASE = 'https://geocoding-api.open-meteo.com/v1/search';

export interface DailyForecast {
  date: string;
  tempMin: number | null;
  tempMax: number | null;
  precipitationMm: number | null;
  precipitationProbabilityPct: number | null;
  windSpeedKmh: number | null;
  windGustsKmh: number | null;
  windDirectionDeg: number | null;
  humidityPct: number | null;
  pressureHpa: null;
  weatherCode: number | null;
  uvIndexMax: number | null;
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  timezone: string;
}

export async function fetchForecast(
  latitude: number,
  longitude: number,
  timezone: string
): Promise<DailyForecast[]> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone,
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'windspeed_10m_max',
      'wind_gusts_10m_max',
      'winddirection_10m_dominant',
      'weathercode',
      'precipitation_probability_max',
      'relative_humidity_2m_max',
      'uv_index_max',
    ].join(','),
    forecast_days: '7',
  });

  const res = await fetch(`${FORECAST_BASE}?${params}`, {
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`Open-Meteo forecast error: ${res.status}`);

  const data = await res.json();
  const d = data.daily;

  return (d.time as string[]).map((date: string, i: number) => ({
    date,
    tempMin:                      d.temperature_2m_min?.[i] ?? null,
    tempMax:                      d.temperature_2m_max?.[i] ?? null,
    precipitationMm:              d.precipitation_sum?.[i] ?? null,
    precipitationProbabilityPct:  d.precipitation_probability_max?.[i] ?? null,
    windSpeedKmh:                 d.windspeed_10m_max?.[i] ?? null,
    windGustsKmh:                 d.wind_gusts_10m_max?.[i] ?? null,
    windDirectionDeg:             d.winddirection_10m_dominant?.[i] ?? null,
    humidityPct:                  d.relative_humidity_2m_max?.[i]       ?? null,
    pressureHpa:                  null as null,
    weatherCode:                  d.weathercode?.[i]                     ?? null,
    uvIndexMax:                   d.uv_index_max?.[i]                    ?? null,
  }));
}

export interface HourlyForecast {
  time: string;
  temp: number | null;
  apparentTemp: number | null;
  weatherCode: number | null;
  windSpeed: number | null;
  windGusts: number | null;
  windDirection: number | null;
  precipitation: number | null;
  pressureHpa: number | null;
}

export async function fetchHourly(
  latitude: number,
  longitude: number,
  timezone: string,
  date: string
): Promise<HourlyForecast[]> {
  return fetchHourlyRange(latitude, longitude, timezone, date, date).then((rows) =>
    rows.map(({ date: _d, ...rest }) => ({
      time:          rest.time,
      temp:          rest.temp,
      apparentTemp:  rest.apparentTemp,
      weatherCode:   rest.weatherCode,
      windSpeed:     rest.windSpeed,
      windGusts:     rest.windGusts,
      windDirection: rest.windDirection,
      precipitation: rest.precipitation,
      pressureHpa:   rest.pressureHpa,
    }))
  );
}

/** Одним запросом Open-Meteo: почасовой прогноз за диапазон дат (включительно), с разбиением по календарным дням в локали локации. */
export async function fetchHourlyRange(
  latitude: number,
  longitude: number,
  timezone: string,
  startDate: string,
  endDate: string
): Promise<
  Array<
    HourlyForecast & {
      date: string;
    }
  >
> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone,
    hourly: 'temperature_2m,apparent_temperature,weathercode,windspeed_10m,wind_gusts_10m,winddirection_10m,precipitation,surface_pressure',
    start_date: startDate,
    end_date: endDate,
  });

  const res = await fetch(`${FORECAST_BASE}?${params}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Open-Meteo hourly range error: ${res.status}`);

  const data = await res.json();
  const h = data.hourly;

  // Debug: проверяем наличие wind_gusts_10m в ответе
  if (!h.wind_gusts_10m) {
    logger.warn(`Open-Meteo: wind_gusts_10m not available for ${latitude},${longitude}`);
  }

  return (h.time as string[]).map((t: string, i: number) => ({
    date:          t.slice(0, 10),
    time:          t.slice(11, 13),
    temp:          h.temperature_2m?.[i]      ?? null,
    apparentTemp:  h.apparent_temperature?.[i] ?? null,
    weatherCode:   h.weathercode?.[i]          ?? null,
    windSpeed:     h.windspeed_10m?.[i]        ?? null,
    windGusts:     h.wind_gusts_10m?.[i]       ?? null,
    windDirection: h.winddirection_10m?.[i]    ?? null,
    precipitation: h.precipitation?.[i]        ?? null,
    pressureHpa:   h.surface_pressure?.[i]     ?? null,
  }));
}

export async function geocodeCity(nameEn: string): Promise<GeocodingResult | null> {
  try {
    const params = new URLSearchParams({ name: nameEn, count: '1', language: 'ru' });
    const res = await fetch(`${GEOCODING_BASE}?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data.results?.[0];
    if (!r) return null;
    return { latitude: r.latitude, longitude: r.longitude, timezone: r.timezone };
  } catch (err) {
    logger.warn('Open-Meteo geocoding failed:', err);
    return null;
  }
}
