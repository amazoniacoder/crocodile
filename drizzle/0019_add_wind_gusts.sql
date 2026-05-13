ALTER TABLE weather_forecasts
  ADD COLUMN IF NOT EXISTS wind_gusts_kmh DECIMAL(5,1);

ALTER TABLE weather_hourly_forecasts
  ADD COLUMN IF NOT EXISTS wind_gusts DECIMAL(5,1);
