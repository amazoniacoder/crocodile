-- Удаление подписок, привязанных к несуществующим токенам
DELETE FROM user_channel_subscriptions
WHERE token_id NOT IN (SELECT id FROM user_tokens);

-- Проверка
SELECT 
  (SELECT COUNT(*) FROM user_tokens) AS tokens_count,
  (SELECT COUNT(*) FROM user_channel_subscriptions) AS subscriptions_count;
