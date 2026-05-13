-- Добавление поля city для географической аналитики
ALTER TABLE page_events ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- Индекс для быстрой фильтрации по городам
CREATE INDEX IF NOT EXISTS idx_page_events_city ON page_events(city) WHERE city IS NOT NULL;

-- Индекс для комбинированной аналитики страна+город
CREATE INDEX IF NOT EXISTS idx_page_events_country_city ON page_events(country, city) WHERE country IS NOT NULL;
