# Telegram Integration — Testing Guide

> Инструкция по тестированию интеграции Telegram-каналов

---

## Предварительные требования

1. **RSSHub запущен:**
   ```bash
   # Проверка
   curl http://localhost:1200/telegram/channel/meduzalive
   ```
   Должен вернуть XML с постами канала.

2. **База данных:**
   ```bash
   # Применить миграцию
   npx drizzle-kit migrate
   ```

3. **Переменные окружения:**
   ```env
   RSSHUB_URL=http://localhost:1200
   TELEGRAM_TOKEN_LENGTH=32
   TELEGRAM_DEFAULT_EXPIRY_DAYS=30
   ```

---

## Шаг 1: Создание токена подписки (Admin)

```bash
curl -X POST http://localhost:5000/api/admin/telegram/subscriptions \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "expiresInDays": 30
  }'
```

**Ожидаемый ответ:**
```json
{
  "success": true,
  "token": "tg_a1b2c3d4e5f6...",
  "id": "uuid",
  "expiresAt": "2025-06-01T00:00:00Z"
}
```

**Сохраните токен** — он понадобится для доступа к ленте.

---

## Шаг 2: Добавление Telegram-канала (Admin)

```bash
curl -X POST http://localhost:5000/api/admin/telegram/sources \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Медуза",
    "channelUsername": "meduzalive",
    "region": "world",
    "category": "politics"
  }'
```

**Ожидаемый ответ:**
```json
{
  "success": true,
  "source": {
    "id": 123,
    "name": "Медуза",
    "url": "https://t.me/meduzalive",
    "rssUrl": "http://localhost:1200/telegram/channel/meduzalive",
    "region": "world",
    "category": "politics",
    "sourceType": "telegram",
    "isActive": true
  }
}
```

---

## Шаг 3: Запуск сбора новостей

### Вариант A: Автоматический сбор (через cron)

Подождите 2-5 минут — сбор запустится автоматически по расписанию.

### Вариант B: Ручной запуск

```bash
curl -X POST http://localhost:5000/api/admin/jobs/rss-collect \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"group": "all"}'
```

**Проверка логов:**
```bash
# В консоли сервера должны появиться строки:
# ✅ Collected 15 articles from Медуза (telegram)
# 📊 Parsing Telegram URL: https://t.me/meduzalive/12345
```

---

## Шаг 4: Проверка данных в БД

```sql
-- Проверить, что статьи сохранились с Telegram-метаданными
SELECT 
  id, 
  title, 
  source_type, 
  channel_username, 
  message_id,
  url
FROM news_articles 
WHERE source_type = 'telegram' 
LIMIT 5;
```

**Ожидаемый результат:**
```
id  | title                  | source_type | channel_username | message_id | url
----|------------------------|-------------|------------------|------------|---------------------------
123 | Новость из Медузы      | telegram    | meduzalive       | 12345      | https://t.me/meduzalive/12345
```

---

## Шаг 5: Тестирование Public API

### 5.1 Preview (без токена)

```bash
curl http://localhost:5000/api/telegram/preview
```

**Ожидаемый ответ:**
```json
{
  "articles": [
    {
      "id": 123,
      "title": "Новость из Медузы",
      "description": "Краткое описание (150 символов)...",
      "imageUrl": "https://...",
      "channelName": "Медуза",
      "publishedAt": "2025-05-20T12:00:00Z"
    }
  ],
  "total": 5,
  "isPreview": true
}
```

### 5.2 Полная лента (с токеном)

```bash
curl http://localhost:5000/api/telegram/news?page=1&limit=20 \
  -H "X-Telegram-Token: tg_a1b2c3d4e5f6..."
```

**Ожидаемый ответ:**
```json
{
  "articles": [
    {
      "id": 123,
      "title": "Новость из Медузы",
      "description": "Полное описание...",
      "imageUrl": "https://...",
      "sourceName": "Медуза",
      "channelUsername": "meduzalive",
      "messageId": 12345,
      "telegramUrl": "https://t.me/meduzalive/12345",
      "publishedAt": "2025-05-20T12:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20,
  "hasMore": true
}
```

### 5.3 Лента конкретного канала

```bash
curl http://localhost:5000/api/telegram/channel/meduzalive?page=1&limit=10 \
  -H "X-Telegram-Token: tg_a1b2c3d4e5f6..."
```

---

## Шаг 6: Тестирование Frontend

### 6.1 Открыть страницу

```
http://localhost:3000/telegram
```

**Ожидаемое поведение:**
1. Отображается preview (3-5 карточек)
2. Карточки обрезаны до 150 символов
3. Кнопка "Читать далее" скроллит к форме авторизации

### 6.2 Ввести токен

1. Вставить токен из Шага 1
2. Нажать "Войти"
3. Должна появиться полная лента

### 6.3 Проверить функционал

- ✅ Клик на заголовок → `/telegram/channel/meduzalive`
- ✅ Кнопка "Читать далее" → `https://t.me/meduzalive/12345` (новая вкладка)
- ✅ Кнопка "Выйти" → удаляет токен, возвращает к preview
- ✅ Ссылка "Получить доступ через Boosty" → `https://boosty.to/crocodile`

---

## Шаг 7: Тестирование Admin UI (Zone L)

### 7.1 Открыть кабинет мониторинга

```
http://localhost:3000/admin/monitor
```

### 7.2 Перейти в Zone L: Telegram Management

**Вкладка "Источники":**
- ✅ Список Telegram-каналов
- ✅ Кнопка "Добавить канал"
- ✅ Форма: name, channelUsername, region, category
- ✅ Кнопки "Редактировать" и "Удалить"

**Вкладка "Подписки":**
- ✅ Список токенов (без самого токена, только метаданные)
- ✅ Кнопка "Создать токен"
- ✅ Форма: name, expiresInDays
- ✅ После создания — токен отображается один раз с кнопкой "Копировать"
- ✅ Кнопка "Отозвать" для каждого токена

---

## Популярные каналы для тестирования

| Канал | Username | Категория | Регион |
|-------|----------|-----------|--------|
| Медуза | `meduzalive` | politics | world |
| РБК | `rbc_news` | economy | russia |
| Коммерсантъ | `kommersant` | economy | russia |
| Meduza (EN) | `meduzaproject` | politics | world |
| ТАСС | `tass_agency` | other | russia |

---

## Troubleshooting

### Проблема: RSSHub возвращает 404

**Решение:**
```bash
# Проверить, что RSSHub запущен
curl http://localhost:1200

# Обновить RSSHub
cd D:\RSSHub
git pull
npm install
npm run build
pm2 restart rsshub
```

### Проблема: Статьи без channel_username/message_id

**Причина:** RSSHub возвращает URL в неожиданном формате.

**Решение:**
1. Проверить URL в RSS:
   ```bash
   curl http://localhost:1200/telegram/channel/meduzalive | grep "<link>"
   ```
2. Если формат отличается от `https://t.me/username/123`, обновить регулярное выражение в `RssParser.ts`:
   ```typescript
   const match = url.match(/t\.me\/([^\/]+)\/(\d+)/);
   ```

### Проблема: 401 Unauthorized при доступе к ленте

**Причина:** Токен невалидный или истёк.

**Решение:**
1. Проверить токен в БД:
   ```sql
   SELECT * FROM telegram_subscriptions WHERE is_active = true;
   ```
2. Создать новый токен через Admin API (Шаг 1)

---

## Метрики успеха

- ✅ Статьи собираются из Telegram-каналов
- ✅ `channel_username` и `message_id` сохраняются корректно
- ✅ Preview работает без токена
- ✅ Полная лента доступна с токеном
- ✅ Кнопка "Читать далее" открывает пост в Telegram
- ✅ Admin UI позволяет управлять каналами и токенами

---

*Последнее обновление: Май 2025*
