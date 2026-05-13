-- 0025_youtube_source_type_check.sql
-- Расширить CHECK constraint source_type для поддержки 'youtube'

ALTER TABLE news_sources DROP CONSTRAINT IF EXISTS news_sources_source_type_check;
ALTER TABLE news_sources ADD CONSTRAINT news_sources_source_type_check
  CHECK (source_type IN ('rss', 'telegram', 'youtube'));

ALTER TABLE news_articles DROP CONSTRAINT IF EXISTS news_articles_source_type_check;
ALTER TABLE news_articles ADD CONSTRAINT news_articles_source_type_check
  CHECK (source_type IN ('rss', 'telegram', 'youtube'));
