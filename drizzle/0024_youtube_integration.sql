-- 0024_youtube_integration.sql
-- YouTube integration: videoId в статьях, isFeatured в источниках

ALTER TABLE news_sources
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE news_articles
  ADD COLUMN IF NOT EXISTS video_id VARCHAR(20);

-- Индекс для быстрой выборки по sourceType=youtube
CREATE INDEX IF NOT EXISTS idx_news_articles_source_type
  ON news_articles (source_type)
  WHERE source_type = 'youtube';

-- Комментарии
COMMENT ON COLUMN news_sources.is_featured IS 'Витринный канал — полностью бесплатен без токена';
COMMENT ON COLUMN news_articles.video_id IS 'YouTube video ID для embed (только для sourceType=youtube)';
