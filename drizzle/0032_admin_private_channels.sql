-- Migration: Admin private channels system
-- Created: 2025-01-XX

-- 0. Включить расширение pgcrypto для gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Добавить флаг is_admin в user_tokens
ALTER TABLE user_tokens ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_user_tokens_is_admin ON user_tokens(is_admin) WHERE is_admin = true;

-- 2. Добавить флаг is_private в news_sources (приватные каналы видны только через admin_channel_access)
ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_news_sources_is_private ON news_sources(is_private) WHERE is_private = true;

-- 3. Создать таблицу связей админ → приватный канал
CREATE TABLE IF NOT EXISTS admin_channel_access (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL REFERENCES user_tokens(id) ON DELETE CASCADE,
  source_id INTEGER NOT NULL REFERENCES news_sources(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(token_id, source_id)
);

CREATE INDEX idx_admin_channel_access_token ON admin_channel_access(token_id);
CREATE INDEX idx_admin_channel_access_source ON admin_channel_access(source_id);

-- 4. Создать бесрочный админский токен (если не существует)
DO $$
DECLARE
  admin_token_id INTEGER;
BEGIN
  -- Проверяем, есть ли уже админский токен
  SELECT id INTO admin_token_id FROM user_tokens WHERE is_admin = true LIMIT 1;
  
  IF admin_token_id IS NULL THEN
    -- Создаём новый админский токен
    INSERT INTO user_tokens (token, label, is_active, expires_at, is_admin)
    VALUES (
      'ut_' || encode(gen_random_bytes(32), 'hex'),
      'Admin Personal Feed (Permanent)',
      true,
      NULL, -- бесрочный
      true
    )
    RETURNING id INTO admin_token_id;
    
    RAISE NOTICE 'Created admin token with ID: %', admin_token_id;
  ELSE
    -- Обновляем существующий токен
    UPDATE user_tokens SET is_admin = true WHERE id = admin_token_id;
    RAISE NOTICE 'Updated existing token % to admin', admin_token_id;
  END IF;
END $$;

-- 5. Вывести админский токен для копирования
DO $$
DECLARE
  admin_token_value TEXT;
BEGIN
  SELECT token INTO admin_token_value FROM user_tokens WHERE is_admin = true LIMIT 1;
  RAISE NOTICE 'Admin token: %', admin_token_value;
END $$;
