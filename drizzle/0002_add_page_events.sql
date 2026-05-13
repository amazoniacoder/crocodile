-- Migration: add page_events table (anonymous analytics)

CREATE TABLE IF NOT EXISTS "page_events" (
  "id"          SERIAL PRIMARY KEY,
  "type"        VARCHAR(20)  NOT NULL,
  "path"        VARCHAR(500),
  "article_id"  INTEGER REFERENCES "news_articles"("id") ON DELETE SET NULL,
  "daily_hash"  VARCHAR(16),
  "created_at"  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_page_events_type"       ON "page_events"("type");
CREATE INDEX IF NOT EXISTS "idx_page_events_created_at" ON "page_events"("created_at");
CREATE INDEX IF NOT EXISTS "idx_page_events_article_id" ON "page_events"("article_id");
