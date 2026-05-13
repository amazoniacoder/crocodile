-- Migration: add weather module tables

CREATE TABLE weather_locations (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  name_en     VARCHAR(100) NOT NULL,
  country     VARCHAR(50)  NOT NULL DEFAULT 'Russia',
  latitude    DECIMAL(8,5) NOT NULL,
  longitude   DECIMAL(8,5) NOT NULL,
  timezone    VARCHAR(50)  NOT NULL DEFAULT 'Europe/Moscow',
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE weather_forecasts (
  id                  SERIAL PRIMARY KEY,
  location_id         INTEGER NOT NULL REFERENCES weather_locations(id) ON DELETE CASCADE,
  forecast_date       DATE    NOT NULL,
  temp_min            DECIMAL(4,1),
  temp_max            DECIMAL(4,1),
  precipitation_mm    DECIMAL(5,1),
  wind_speed_kmh      DECIMAL(5,1),
  wind_direction_deg  INTEGER,
  humidity_pct        INTEGER,
  pressure_hpa        DECIMAL(6,1),
  weather_code        INTEGER,
  moon_phase          DECIMAL(4,3),
  moon_phase_name     VARCHAR(30),
  kp_index            DECIMAL(3,1),
  kp_level            VARCHAR(20),
  fetched_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(location_id, forecast_date)
);

CREATE INDEX idx_weather_forecasts_location_date ON weather_forecasts(location_id, forecast_date);
CREATE INDEX idx_weather_forecasts_date ON weather_forecasts(forecast_date);
CREATE INDEX idx_weather_locations_active ON weather_locations(is_active, sort_order);
