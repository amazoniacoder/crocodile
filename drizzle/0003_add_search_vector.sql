-- Migration: add search_vector column with GIN index for full-text search

ALTER TABLE news_articles
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('russian', coalesce(title, '') || ' ' || coalesce(description, ''))
    ||
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_news_articles_search_vector
  ON news_articles USING GIN(search_vector);
