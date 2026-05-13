-- Таблица почасовых прогнозов погоды
CREATE TABLE IF NOT EXISTS weather_hourly_forecasts (
  id            SERIAL PRIMARY KEY,
  location_id   INTEGER NOT NULL REFERENCES weather_locations(id) ON DELETE CASCADE,
  forecast_dt   TIMESTAMP NOT NULL,
  temp          DECIMAL(4,1),
  weather_code  INTEGER,
  wind_speed    DECIMAL(5,1),
  wind_dir      INTEGER,
  precipitation DECIMAL(5,1),
  pressure_hpa  DECIMAL(6,1),
  fetched_at    TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(location_id, forecast_dt)
);

CREATE INDEX IF NOT EXISTS idx_weather_hourly_location_dt
  ON weather_hourly_forecasts(location_id, forecast_dt);

CREATE INDEX IF NOT EXISTS idx_weather_hourly_dt
  ON weather_hourly_forecasts(forecast_dt);
