-- Migration: add article_reactions table

CREATE TABLE IF NOT EXISTS "article_reactions" (
  "id"          SERIAL PRIMARY KEY,
  "article_id"  INTEGER NOT NULL REFERENCES "news_articles"("id") ON DELETE CASCADE,
  "type"        VARCHAR(10) NOT NULL,  -- 'like' | 'dislike'
  "created_at"  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_article_reactions_article_id" ON "article_reactions"("article_id");
CREATE INDEX IF NOT EXISTS "idx_article_reactions_type"       ON "article_reactions"("type");
CREATE INDEX IF NOT EXISTS "idx_article_reactions_created_at" ON "article_reactions"("created_at");
