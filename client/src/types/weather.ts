export interface WeatherLocation {
  id: number;
  name: string;
  country: string;
  latitude: string;
  longitude: string;
  timezone: string;
}

export interface WeatherForecast {
  id: number;
  forecastDate: string;
  tempMin: string | null;
  tempMax: string | null;
  precipitationMm: string | null;
  windSpeedKmh: string | null;
  windGustsKmh: string | null;
  windDirectionDeg: number | null;
  humidityPct: number | null;
  precipitationProbabilityPct: number | null;
  pressureHpa: string | null;
  weatherCode: number | null;
  moonPhaseName: string | null;
  moonPhase: string | null;
  kpIndex: string | null;
  kpLevel: string | null;
  uvIndexMax: string | null;
}

export interface HourlyRow {
  date: string;
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
