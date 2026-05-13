ALTER TABLE weather_forecasts
  ADD COLUMN IF NOT EXISTS uv_index_max DECIMAL(3,1);
