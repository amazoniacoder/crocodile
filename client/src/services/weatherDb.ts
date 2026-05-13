import Dexie, { Table } from 'dexie';

// Интерфейсы для IndexedDB
export interface WeatherLocation {
  id: number;
  name: string;
  country: string;
  timezone: string;
  fetchedAt: number; // timestamp
}

export interface DailyForecast {
  locationId: number;
  date: string;
  tempMin: number | null;
  tempMax: number | null;
  precipitationMm: number | null;
  precipitationProbabilityPct: number | null;
  windSpeedKmh: number | null;
  windGustsKmh: number | null;
  windDirectionDeg: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  weatherCode: number | null;
  moonPhase: number | null;
  moonPhaseName: string | null;
  kpIndex: number | null;
  kpLevel: string | null;
  uvIndexMax: number | null;
  fetchedAt: number;
}

export interface HourlyForecast {
  locationId: number;
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
  fetchedAt: number;
}

class WeatherDatabase extends Dexie {
  locations!: Table<WeatherLocation, number>;
  daily!: Table<DailyForecast, [number, string]>; // composite key [locationId, date]
  hourly!: Table<HourlyForecast, [number, string, string]>; // composite key [locationId, date, time]

  constructor() {
    super('weather-cache');
    
    this.version(1).stores({
      locations: 'id, name, fetchedAt',
      daily: '[locationId+date], locationId, fetchedAt',
      hourly: '[locationId+date+time], locationId, date, fetchedAt'
    });
    
    // Version 2: Add windDirection and pressureHpa to hourly data
    this.version(2).stores({
      locations: 'id, name, fetchedAt',
      daily: '[locationId+date], locationId, fetchedAt',
      hourly: '[locationId+date+time], locationId, date, fetchedAt'
    }).upgrade(tx => {
      // Clear existing hourly data to avoid schema conflicts
      return tx.table('hourly').clear();
    });
    
    // Version 3: Add windGusts to hourly data
    this.version(3).stores({
      locations: 'id, name, fetchedAt',
      daily: '[locationId+date], locationId, fetchedAt',
      hourly: '[locationId+date+time], locationId, date, fetchedAt'
    }).upgrade(tx => {
      // Clear existing hourly data to avoid schema conflicts
      return tx.table('hourly').clear();
    });
  }
}

export const weatherDb = new WeatherDatabase();
