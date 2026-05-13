-- Migration: add collection_stats and source_config tables

CREATE TABLE IF NOT EXISTS "collection_stats" (
  "id"                 SERIAL PRIMARY KEY,
  "source_id"          INTEGER REFERENCES "news_sources"("id") ON DELETE SET NULL,
  "collected_at"       TIMESTAMP NOT NULL DEFAULT NOW(),
  "articles_inserted"  INTEGER NOT NULL DEFAULT 0,
  "articles_duplicate" INTEGER NOT NULL DEFAULT 0,
  "fetch_duration_ms"  INTEGER,
  "avg_latency_ms"     INTEGER,
  "error_count"        INTEGER NOT NULL DEFAULT 0,
  "last_error"         TEXT
);

CREATE INDEX IF NOT EXISTS "idx_collection_stats_source_id"    ON "collection_stats"("source_id");
CREATE INDEX IF NOT EXISTS "idx_collection_stats_collected_at" ON "collection_stats"("collected_at");

CREATE TABLE IF NOT EXISTS "source_config" (
  "key"        VARCHAR(100) PRIMARY KEY,
  "value"      TEXT NOT NULL,
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Значения по умолчанию для интервалов cron
INSERT INTO "source_config" ("key", "value") VALUES
  ('fast_interval_cron', '* * * * *'),
  ('slow_interval_cron', '*/5 * * * *')
ON CONFLICT ("key") DO NOTHING;
