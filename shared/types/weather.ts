// Типы для API погоды

export interface WeatherLocation {
  id: number;
  name: string;
  country: string;
  latitude?: string;
  longitude?: string;
  timezone: string;
}

export interface DailyForecast {
  id?: number;
  locationId?: number;
  forecastDate: string; // YYYY-MM-DD
  tempMin: string | null;
  tempMax: string | null;
  precipitationMm: string | null;
  windSpeedKmh: string | null;
  windDirectionDeg: number | null;
  humidityPct: number | null;
  pressureHpa: string | null;
  weatherCode: number | null;
  moonPhase?: string | null;
  moonPhaseName?: string | null;
  kpIndex?: string | null;
  kpLevel?: string | null;
  fetchedAt?: string;
}

export interface HourlyForecast {
  date: string; // YYYY-MM-DD
  time: string; // HH
  temp: number | null;
  weatherCode: number | null;
  windSpeed: number | null;
  precipitation: number | null;
}

// Ответ GET /api/weather/week
export interface WeatherWeekResponse {
  location: WeatherLocation;
  forecasts: DailyForecast[];
  hourly: HourlyForecast[];
}

// Ответ GET /api/weather
export interface WeatherResponse {
  location: WeatherLocation;
  forecasts: DailyForecast[];
}

// Ответ GET /api/weather/hourly
export interface WeatherHourlyResponse {
  hours: Omit<HourlyForecast, 'date'>[];
}

// Ответ GET /api/weather/locations
export interface WeatherLocationsResponse {
  locations: WeatherLocation[];
}
