-- Проверка приватных каналов в БД

-- 1. Все приватные каналы
SELECT 
  id, 
  name, 
  source_type, 
  is_private, 
  is_active,
  username,
  channel_id,
  created_at
FROM news_sources 
WHERE is_private = true 
ORDER BY id DESC;

-- 2. Связи админ-токен → приватные каналы
SELECT 
  aca.token_id,
  aca.source_id,
  ns.name,
  ns.source_type,
  ut.label as token_label
FROM admin_channel_access aca
JOIN news_sources ns ON aca.source_id = ns.id
JOIN user_tokens ut ON aca.token_id = ut.id
ORDER BY aca.source_id DESC;

-- 3. Статистика по приватным каналам
SELECT 
  ns.name,
  ns.source_type,
  COUNT(na.id) as articles_count,
  MAX(na.published_at) as newest_article,
  MIN(na.published_at) as oldest_article
FROM news_sources ns
LEFT JOIN news_articles na ON ns.id = na.source_id
WHERE ns.is_private = true AND ns.is_active = true
GROUP BY ns.id, ns.name, ns.source_type
ORDER BY articles_count DESC;

-- 4. Админский токен
SELECT 
  id,
  label,
  is_admin,
  is_active,
  created_at,
  expires_at
FROM user_tokens 
WHERE is_admin = true;
