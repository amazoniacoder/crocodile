-- Migration: Add Top 10 Russian Telegram Channels
-- Created: 2025-05-07
-- Description: Adds 10 popular Russian Telegram news channels as sources

-- Insert top 10 Telegram channels
INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active) VALUES
  -- 1. Медуза LIVE
  ('Медуза LIVE', 'https://t.me/meduzalive', 'http://localhost:1200/telegram/channel/meduzalive', 'world', 'politics', 'telegram', true),
  
  -- 2. РИА Новости
  ('РИА Новости (Telegram)', 'https://t.me/rian_ru', 'http://localhost:1200/telegram/channel/rian_ru', 'russia', 'other', 'telegram', true),
  
  -- 3. ТАСС
  ('ТАСС (Telegram)', 'https://t.me/tass_agency', 'http://localhost:1200/telegram/channel/tass_agency', 'russia', 'other', 'telegram', true),
  
  -- 4. Коммерсантъ
  ('Коммерсантъ (Telegram)', 'https://t.me/kommersant', 'http://localhost:1200/telegram/channel/kommersant', 'russia', 'economy', 'telegram', true),
  
  -- 5. РБК
  ('РБК (Telegram)', 'https://t.me/rbc_news', 'http://localhost:1200/telegram/channel/rbc_news', 'russia', 'economy', 'telegram', true),
  
  -- 6. Интерфакс
  ('Интерфакс (Telegram)', 'https://t.me/interfaxonline', 'http://localhost:1200/telegram/channel/interfaxonline', 'russia', 'other', 'telegram', true),
  
  -- 7. Ведомости
  ('Ведомости (Telegram)', 'https://t.me/vedomosti', 'http://localhost:1200/telegram/channel/vedomosti', 'russia', 'economy', 'telegram', true),
  
  -- 8. Известия
  ('Известия (Telegram)', 'https://t.me/izvestia', 'http://localhost:1200/telegram/channel/izvestia', 'russia', 'other', 'telegram', true),
  
  -- 9. Газета.Ru
  ('Газета.Ru (Telegram)', 'https://t.me/gazetaru', 'http://localhost:1200/telegram/channel/gazetaru', 'russia', 'other', 'telegram', true),
  
  -- 10. Fontanka.ru
  ('Fontanka.ru (Telegram)', 'https://t.me/fontankaspb', 'http://localhost:1200/telegram/channel/fontankaspb', 'russia', 'other', 'telegram', true);
