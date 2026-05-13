-- Migration 0030: Link push_subscriptions to user_tokens

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS token_id INTEGER REFERENCES user_tokens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_token ON push_subscriptions(token_id)
  WHERE token_id IS NOT NULL;

SELECT 'Migration 0030 applied successfully' AS status;
