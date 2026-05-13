-- Migration 0029: Add user_bookmarks table

CREATE TABLE user_bookmarks (
  id         SERIAL PRIMARY KEY,
  token_id   INTEGER NOT NULL REFERENCES user_tokens(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (token_id, article_id)
);

CREATE INDEX idx_user_bookmarks_token ON user_bookmarks(token_id);

SELECT 'Migration 0029 applied successfully' AS status;
