-- Migration 0028: Add is_featured to news_sources
-- Используется для разграничения витринных каналов (общий доступ) и остальных (только по подписке)

ALTER TABLE news_sources
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_news_sources_featured
  ON news_sources(is_featured)
  WHERE source_type IN ('telegram', 'youtube');

SELECT 'Migration 0028 applied successfully' AS status;
