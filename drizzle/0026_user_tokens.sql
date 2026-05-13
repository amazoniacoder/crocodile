-- ============================================================
-- Миграция 0026: Personal Feed — токены и подписки
-- Дата: Май 2025
-- ============================================================

-- Таблица токенов доступа к личным кабинетам
CREATE TABLE IF NOT EXISTS user_tokens (
  id SERIAL PRIMARY KEY,
  token VARCHAR(64) UNIQUE NOT NULL,
  label VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP
);

COMMENT ON TABLE user_tokens IS 'Токены доступа к личным кабинетам (Personal Feed)';
COMMENT ON COLUMN user_tokens.token IS 'Токен формата ut_<32 random bytes hex>';
COMMENT ON COLUMN user_tokens.label IS 'Метка для админа (например, "Подписчик Boosty #123")';
COMMENT ON COLUMN user_tokens.is_active IS 'Активен ли токен';
COMMENT ON COLUMN user_tokens.expires_at IS 'Дата истечения токена (опционально)';
COMMENT ON COLUMN user_tokens.last_used_at IS 'Последнее использование токена';

-- Таблица подписок пользователя на каналы
CREATE TABLE IF NOT EXISTS user_channel_subscriptions (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL REFERENCES user_tokens(id) ON DELETE CASCADE,
  source_id INTEGER NOT NULL REFERENCES news_sources(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(token_id, source_id)
);

COMMENT ON TABLE user_channel_subscriptions IS 'Подписки пользователей на Telegram/YouTube каналы';
COMMENT ON COLUMN user_channel_subscriptions.token_id IS 'ID токена пользователя';
COMMENT ON COLUMN user_channel_subscriptions.source_id IS 'ID источника (канала)';

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_user_tokens_token ON user_tokens(token);
CREATE INDEX IF NOT EXISTS idx_user_tokens_active ON user_tokens(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_tokens_expires ON user_tokens(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_channel_subs_token ON user_channel_subscriptions(token_id);
CREATE INDEX IF NOT EXISTS idx_user_channel_subs_source ON user_channel_subscriptions(source_id);

-- Проверка
SELECT 'Migration 0026 applied successfully' AS status;
