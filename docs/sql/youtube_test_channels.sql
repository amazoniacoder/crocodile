-- ============================================================
-- Тестовые YouTube-каналы для проверки парсинга
-- pgAdmin: Query Tool → вставить → F5
-- ============================================================

INSERT INTO news_sources (name, url, rss_url, region, category, source_type, is_active, is_featured)
VALUES
  -- Мировые / tech
  ('Veritasium',
   'https://www.youtube.com/channel/UCHnyfMqiRRG1u-2MsSQLbXA',
   'https://www.youtube.com/feeds/videos.xml?channel_id=UCHnyfMqiRRG1u-2MsSQLbXA',
   'world', 'tech', 'youtube', true, true),

  ('Kurzgesagt',
   'https://www.youtube.com/channel/UCsXVk37bltHxD1rDPwtNM8Q',
   'https://www.youtube.com/feeds/videos.xml?channel_id=UCsXVk37bltHxD1rDPwtNM8Q',
   'world', 'tech', 'youtube', true, false),

  ('Fireship',
   'https://www.youtube.com/channel/UCsBjURrPoezykLs9EqgamOA',
   'https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA',
   'world', 'tech', 'youtube', true, false),

  ('TED',
   'https://www.youtube.com/channel/UCAuUUnT6oDeKwE6v1NGQxug',
   'https://www.youtube.com/feeds/videos.xml?channel_id=UCAuUUnT6oDeKwE6v1NGQxug',
   'world', 'other', 'youtube', true, false),

  -- Россия / экономика
  ('РБК',
   'https://www.youtube.com/channel/UC295-Dw0tDd-hoVEjEmBcnA',
   'https://www.youtube.com/feeds/videos.xml?channel_id=UC295-Dw0tDd-hoVEjEmBcnA',
   'russia', 'economy', 'youtube', true, false),

  -- Россия / политика
  ('Редакция',
   'https://www.youtube.com/channel/UCwqPCCnBMSFOzBfMnFBBGkA',
   'https://www.youtube.com/feeds/videos.xml?channel_id=UCwqPCCnBMSFOzBfMnFBBGkA',
   'russia', 'politics', 'youtube', true, false),

  -- Россия / tech
  ('Хабр',
   'https://www.youtube.com/channel/UCeObZv89Stb2xLtjLJ0De3Q',
   'https://www.youtube.com/feeds/videos.xml?channel_id=UCeObZv89Stb2xLtjLJ0De3Q',
   'russia', 'tech', 'youtube', true, false)

ON CONFLICT DO NOTHING;

-- Проверка:
SELECT id, name, region, category, is_active, is_featured,
       substring(rss_url, 'channel_id=([^&]+)') AS channel_id
FROM news_sources
WHERE source_type = 'youtube'
ORDER BY id;
