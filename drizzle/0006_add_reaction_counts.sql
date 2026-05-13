-- Migration: add likes_count and dislikes_count to news_articles

ALTER TABLE news_articles
  ADD COLUMN IF NOT EXISTS likes_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dislikes_count INTEGER NOT NULL DEFAULT 0;
