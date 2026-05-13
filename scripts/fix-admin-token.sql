-- Исправление: установить is_admin = true для токена id=2
-- Выполнить в pgAdmin или psql

-- 1. Проверить текущий статус токена
SELECT id, token, label, is_admin, is_active, expires_at 
FROM user_tokens 
WHERE id = 2;

-- 2. Установить is_admin = true
UPDATE user_tokens 
SET is_admin = true 
WHERE id = 2;

-- 3. Проверить результат
SELECT id, token, label, is_admin, is_active, expires_at 
FROM user_tokens 
WHERE id = 2;

-- 4. Проверить, есть ли записи в admin_channel_access для этого токена
SELECT 
  aca.id,
  aca.token_id,
  aca.source_id,
  ns.name AS channel_name,
  ns.source_type,
  ns.is_private
FROM admin_channel_access aca
JOIN news_sources ns ON aca.source_id = ns.id
WHERE aca.token_id = 2
ORDER BY ns.name;

-- 5. Если записей нет, добавить доступ ко всем приватным YouTube-каналам
INSERT INTO admin_channel_access (token_id, source_id)
SELECT 2, id
FROM news_sources
WHERE is_private = true AND source_type = 'youtube'
ON CONFLICT (token_id, source_id) DO NOTHING;

-- 6. Проверить финальный результат
SELECT COUNT(*) AS private_channels_count
FROM admin_channel_access
WHERE token_id = 2;
