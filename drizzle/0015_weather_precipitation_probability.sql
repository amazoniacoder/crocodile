-- Добавить вероятность осадков как отдельное поле
-- humidityPct теперь хранит реальную влажность воздуха (relative_humidity_2m_max)
ALTER TABLE weather_forecasts
  ADD COLUMN IF NOT EXISTS precipitation_probability_pct INTEGER;
