-- Проверка текущего состояния приватных YouTube-каналов

SELECT 
  id,
  name,
  channel_id,
  rss_url,
  is_active,
  last_fetched_at,
  (SELECT COUNT(*) FROM news_articles WHERE source_id = ns.id) as articles_count
FROM news_sources ns
WHERE is_private = true AND source_type = 'youtube'
ORDER BY name;
