-- Migration: add daily_hash to article_reactions

ALTER TABLE article_reactions
  ADD COLUMN IF NOT EXISTS daily_hash VARCHAR(16);

CREATE INDEX IF NOT EXISTS idx_article_reactions_daily_hash
  ON article_reactions(article_id, daily_hash);
