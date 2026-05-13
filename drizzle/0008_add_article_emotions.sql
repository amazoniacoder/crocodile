-- Эмодзи-реакции: одна строка на пару article_id + daily_hash (идентификатор «посетителя на день»)

CREATE TABLE IF NOT EXISTS article_emotions (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  emotion_id VARCHAR(32) NOT NULL,
  daily_hash VARCHAR(16) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_article_emotions_article_daily
  ON article_emotions(article_id, daily_hash);

CREATE INDEX IF NOT EXISTS idx_article_emotions_article ON article_emotions(article_id);
CREATE INDEX IF NOT EXISTS idx_article_emotions_created ON article_emotions(created_at);
