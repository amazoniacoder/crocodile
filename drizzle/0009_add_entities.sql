-- 0009_add_entities.sql

ALTER TABLE news_articles
  ADD COLUMN IF NOT EXISTS entities JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_news_articles_entities
  ON news_articles USING GIN(entities);

CREATE TABLE IF NOT EXISTS hot_entities (
  id            SERIAL PRIMARY KEY,
  entity_text   VARCHAR(255) NOT NULL,
  entity_type   VARCHAR(10)  NOT NULL,
  mention_count INTEGER      NOT NULL DEFAULT 0,
  period_start  TIMESTAMP    NOT NULL,
  updated_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  UNIQUE (entity_text, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_hot_entities_type  ON hot_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_hot_entities_count ON hot_entities(mention_count DESC);
