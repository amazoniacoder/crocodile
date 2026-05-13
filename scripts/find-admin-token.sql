-- Найти админский токен
SELECT id, token, label, is_admin, is_active, expires_at, created_at
FROM user_tokens
WHERE is_admin = true
ORDER BY created_at DESC;

-- Проверить, есть ли у админского токена доступ к приватным каналам
SELECT 
  ut.id AS token_id,
  ut.token,
  ut.label,
  COUNT(aca.id) AS private_channels_count
FROM user_tokens ut
LEFT JOIN admin_channel_access aca ON ut.id = aca.token_id
WHERE ut.is_admin = true
GROUP BY ut.id, ut.token, ut.label;

-- Показать все приватные YouTube-каналы
SELECT id, name, channel_id, is_private, is_active
FROM news_sources
WHERE is_private = true AND source_type = 'youtube'
ORDER BY name;
