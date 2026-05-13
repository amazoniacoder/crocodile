ALTER TABLE weather_hourly_forecasts
  ADD COLUMN IF NOT EXISTS apparent_temp DECIMAL(4,1);
