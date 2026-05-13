# Telegram Integration Guide

> Полное руководство по интеграции Telegram-каналов в Crocodile
> Версия: 2.0 | Дата: Май 2025

---

## Содержание

1. [Обзор](#обзор)
2. [Архитектура](#архитектура)
3. [Установка и настройка](#установка-и-настройка)
4. [Использование](#использование)
5. [API Reference](#api-reference)
6. [Troubleshooting](#troubleshooting)

---

## Обзор

### Что это?

Модуль агрегации постов из публичных Telegram-каналов через RSSHub. Посты собираются как обычные статьи с `sourceType = 'telegram'` и отображаются на странице `/social`.

### Ключевые возможности

- ✅ Сбор постов из публичных Telegram-каналов через RSSHub
- ✅ Публичный доступ без токенов и авторизации
- ✅ Страница конкретного канала (`/social/channel/:username`)
- ✅ Прямые ссылки на посты в Telegram
- ✅ Бейдж «Telegram» на карточках
- ✅ Флаг включения/отключения страницы через ZoneL
- ✅ Виртуализированная лента с бесконечной прокруткой
- ✅ WebSocket-уведомления о новых постах

---

## Архитектура

### Компоненты

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
├─────────────────────────────────────────────────────────────┤
│  TelegramPage (/social)                                     │
│    → проверяет флаг /api/telegram/status                    │
│    → рендерит SocialAggregator                              │
│  TelegramChannelPage (/social/channel/:username)            │
│    → рендерит SocialAggregator с channelUsername            │
│  SocialAggregator                                           │
│    → GET /api/news?sourceType=telegram[&channelUsername=]   │
│    → NewsFeed с onArticleClick → /social/channel/:username  │
│  ZoneL (Admin) → управление источниками и статистикой       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Backend API                             │
├─────────────────────────────────────────────────────────────┤
│  Public (без авторизации):                                   │
│    GET  /api/telegram/status                                │
│    GET  /api/telegram/channel/:username                     │
│    GET  /api/news?sourceType=telegram                       │
│    GET  /api/news?sourceType=telegram&channelUsername=...   │
│                                                              │
│  Admin (authenticateAdmin):                                  │
│    GET/POST/PATCH/DELETE /api/admin/telegram/sources        │
│    GET/POST/DELETE       /api/admin/telegram/subscriptions  │
│    GET                   /api/admin/telegram/stats          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Infrastructure                            │
├─────────────────────────────────────────────────────────────┤
│  RssParser → парсит channelUsername и messageId из URL      │
│  CollectNewsUseCase → сбор через RSSHub                     │
│  TelegramSubscriptionService → CRUD токенов (admin only)    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      External Services                       │
├─────────────────────────────────────────────────────────────┤
│  RSSHub (localhost:1200) → /telegram/channel/{username}     │
│  PostgreSQL → news_sources, news_articles,                  │
│               telegram_subscriptions                         │
└─────────────────────────────────────────────────────────────┘
```

### База данных

1. **news_sources** (расширена)
   - `source_type` — 'rss' | 'telegram'
   - Для Telegram: `url` = `https://t.me/{username}`, `rssUrl` = `{RSSHUB_URL}/telegram/channel/{username}`

2. **news_articles** (расширена)
   - `source_type` — 'rss' | 'telegram'
   - `channel_username` — username канала (без @)
   - `message_id` — ID поста в канале

3. **telegram_subscriptions** — хранит токены подписки (управляются через Admin API)

### Поток данных

```
1. Admin добавляет канал
   → POST /api/admin/telegram/sources
   → Автогенерация rssUrl через RSSHub

2. Cron запускает сбор
   → CollectNewsUseCase
   → RssParser парсит RSS от RSSHub
   → Извлекает channelUsername и messageId из URL t.me/username/123
   → Сохраняет в news_articles с sourceType='telegram'

3. User открывает /social
   → TelegramPage проверяет GET /api/telegram/status
   → При enabled=true рендерит SocialAggregator
   → SocialAggregator: GET /api/news?sourceType=telegram

4. User кликает на карточку канала
   → navigate('/social/channel/{username}')
   → TelegramChannelPage → SocialAggregator с channelUsername
   → GET /api/news?sourceType=telegram&channelUsername={username}

5. User кликает «Читать в Telegram»
   → Открывается https://t.me/{username}/{messageId}
```

---

## Установка и настройка

### Шаг 1: RSSHub

**Проверка:**
```bash
curl http://localhost:1200/telegram/channel/meduzalive
```

Если RSSHub не установлен:
```bash
git clone https://github.com/DIYgod/RSSHub.git D:\RSSHub
cd D:\RSSHub
npm install
npm run build
npm run dev
```

**Управление через PM2:**
```bash
pm2 start npm --name rsshub -- run dev
pm2 save
pm2 startup
```

### Шаг 2: Миграции БД

```bash
cd D:\BlogPro
npx drizzle-kit migrate
```

### Шаг 3: Переменные окружения

Добавить в `.env`:
```env
# RSSHub
RSSHUB_URL=http://localhost:1200
```

### Шаг 4: Перезапуск сервера

```bash
npm run dev
```

---

## Использование

### Для администратора

#### 1. Добавление канала

**Через админку:**
1. Открыть http://localhost:3000/admin/monitor
2. Перейти в Zone L: Telegram Management
3. Вкладка «Источники» → «Добавить канал»
4. Заполнить форму:
   - Название: Медуза
   - Username: meduzalive (без @)
   - Регион: Мир
   - Категория: Политика
5. Нажать «Добавить»

**Через API:**
```bash
curl -X POST http://localhost:5000/api/admin/telegram/sources \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Медуза",
    "channelUsername": "meduzalive",
    "region": "world",
    "category": "politics"
  }'
```

#### 2. Включение/отключение страницы

Zone L → кнопка включения/отключения (флаг `telegram_page_enabled`).

При `enabled=false` пользователь видит заглушку «В разработке» на `/social`.

#### 3. Запуск сбора

**Автоматически:** по расписанию fast/slow из `source_config`.

**Вручную:**
```bash
curl -X POST http://localhost:5000/api/admin/jobs/rss-collect \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"group": "all"}'
```

#### 4. Статистика

```bash
curl http://localhost:5000/api/admin/telegram/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Для пользователя

1. Открыть http://localhost:3000/social — лента всех Telegram-каналов
2. Клик на карточку → `/social/channel/{username}` — посты конкретного канала
3. Кнопка «Читать в Telegram» → `https://t.me/{username}/{messageId}`

---

## API Reference

### Public API

#### GET /api/telegram/status

Флаг включения страницы.

**Ответ:**
```json
{ "enabled": true }
```

#### GET /api/telegram/channel/:username

Информация о канале для заголовка страницы.

**Параметры:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)

**Ответ:**
```json
{
  "channel": {
    "username": "meduzalive",
    "name": "Медуза",
    "region": "world",
    "category": "politics"
  },
  "page": 1,
  "limit": 20
}
```

**Ошибки:**
- `404 Not Found` — канал не найден в `news_sources`

#### GET /api/news?sourceType=telegram

Лента постов всех Telegram-каналов. Стандартный эндпоинт `/api/news` с фильтром.

**Параметры:**
- `sourceType=telegram` — обязательный фильтр
- `channelUsername` — фильтр по конкретному каналу
- `page` (default: 1)
- `limit` (default: 20, max: 100)

**Ответ:** стандартный `NewsListResponse` (см. `DEVELOPER_GUIDE.md`).

### Admin API

Все роуты требуют `Authorization: Bearer {ADMIN_TOKEN}`.

#### GET /api/admin/telegram/sources

Список Telegram-каналов.

**Ответ:**
```json
{
  "success": true,
  "sources": [
    {
      "id": 123,
      "name": "Медуза",
      "url": "https://t.me/meduzalive",
      "rssUrl": "http://localhost:1200/telegram/channel/meduzalive",
      "region": "world",
      "category": "politics",
      "sourceType": "telegram",
      "isActive": true,
      "createdAt": "2025-05-20T12:00:00Z"
    }
  ],
  "total": 1
}
```

#### POST /api/admin/telegram/sources

Добавить Telegram-канал.

**Body:**
```json
{
  "name": "Медуза",
  "channelUsername": "meduzalive",
  "region": "world",
  "category": "politics"
}
```

#### PATCH /api/admin/telegram/sources/:id

Обновить канал.

**Body:**
```json
{
  "name": "Новое название",
  "region": "russia",
  "category": "tech",
  "isActive": false
}
```

#### DELETE /api/admin/telegram/sources/:id

Деактивировать канал (не удаляет физически, устанавливает `isActive=false`).

#### GET /api/admin/telegram/stats

Статистика сбора по каналам.

**Ответ:**
```json
{
  "stats": [
    {
      "sourceName": "Медуза",
      "articlesCount": 150,
      "lastFetched": "2025-05-20T12:00:00Z",
      "oldestArticle": "2025-05-01T00:00:00Z",
      "newestArticle": "2025-05-20T12:00:00Z"
    }
  ]
}
```

#### GET /api/admin/telegram/subscriptions

Список токенов подписки.

#### POST /api/admin/telegram/subscriptions

Создать токен подписки.

**Body:**
```json
{
  "name": "Premium User #1",
  "expiresInDays": 30
}
```

**Ответ:**
```json
{
  "success": true,
  "token": "tg_a1b2c3d4e5f6...",
  "id": "uuid",
  "expiresAt": "2025-06-20T00:00:00Z"
}
```

⚠️ **Токен показывается только один раз!**

#### DELETE /api/admin/telegram/subscriptions/:id

Отозвать токен подписки.

---

## Troubleshooting

### Проблема: RSSHub возвращает 404

**Причина:** RSSHub не поддерживает Telegram-роут или не запущен.

**Решение:**
```bash
curl http://localhost:1200/telegram/channel/meduzalive

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

### Проблема: Страница /social показывает заглушку «В разработке»

**Причина:** флаг `telegram_page_enabled` = `false`.

**Решение:** Zone L в кабинете мониторинга → включить страницу.

### Проблема: Нет стилей на странице /social

**Причина:** `telegram.css` не подключен в `main.css`.

**Решение:**
Проверить `client/src/ui-system/main.css`:
```css
@import './patterns/telegram.css';
```

### Проблема: Пустая лента после сбора

**Решение:**
1. Проверить источники:
   ```sql
   SELECT * FROM news_sources WHERE source_type = 'telegram';
   ```

2. Проверить статьи:
   ```sql
   SELECT COUNT(*) FROM news_articles WHERE source_type = 'telegram';
   ```

3. Запустить сбор вручную:
   ```bash
   curl -X POST http://localhost:5000/api/admin/jobs/rss-collect \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"group": "all"}'
   ```

### Проблема: RSSHub завис

```bash
pm2 restart rsshub
```

---

## Популярные каналы для тестирования

| Канал | Username | Категория | Регион |
|-------|----------|-----------|--------|
| Медуза | `meduzalive` | politics | world |
| РБК | `rbc_news` | economy | russia |
| Коммерсантъ | `kommersant` | economy | russia |
| ТАСС | `tass_agency` | other | russia |
| Habr | `habr_com` | tech | russia |
| VC.ru | `vcru` | tech | russia |

---

*Последнее обновление: Май 2025*
