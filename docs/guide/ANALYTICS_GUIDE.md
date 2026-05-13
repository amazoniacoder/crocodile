# Анонимная аналитика

> Статус: Production  
> Версия: 1.4.0  
> Реализовано: Июль 2026

---

## Концепция

Собираем только анонимные события без возможности идентификации пользователя:

- **Pageview** — факт открытия страницы
- **Article click** — клик по заголовку-ссылке новости

Никаких cookie, fingerprint, localStorage. IP не хранится — используется только для вычисления суточного хэша уникального визита, после чего отбрасывается.

**Принцип хэширования уникальности:**
```
daily_hash = SHA256(IP + UserAgent + YYYY-MM-DD)
```
Один пользователь в один день = один хэш. IP восстановить невозможно. Это соответствует privacy-friendly аналитике (Plausible, Fathom) и не является персональными данными по 152-ФЗ / GDPR.

---

## Архитектура

### Таблица БД `page_events`

```sql
CREATE TABLE page_events (
  id           SERIAL PRIMARY KEY,
  type         VARCHAR(20)  NOT NULL,  -- 'pageview' | 'article_click'
  path         VARCHAR(500),
  article_id   INTEGER REFERENCES news_articles(id) ON DELETE SET NULL,
  daily_hash   VARCHAR(16),            -- SHA256(IP+UA+date)[:16], IP не хранится
  created_at   TIMESTAMP DEFAULT NOW()
);
```

Миграция: `drizzle/0002_add_page_events.sql`  
Drizzle-схема: `shared/types/schema.ts` → `pageEvents`

### Структура файлов

```
server/
├── api/
│   ├── events/index.ts              — POST /api/events (rate limit 60/min)
│   └── admin/analytics.ts          — GET /api/admin/analytics/*
└── infrastructure/persistence/
    └── PageEventRepository.ts      — все запросы к page_events

client/src/
├── services/analytics.ts           — sendBeacon-обёртка
├── App.tsx                         — трекинг pageview при смене маршрута
├── components/news/NewsCard.tsx    — трекинг article_click
└── components/admin/monitor/ZoneD/ — виджет аналитики в кабинете
    ├── ZoneD.tsx
    ├── AnalyticsSummaryCards.tsx
    ├── AnalyticsHourlyChart.tsx
    ├── AnalyticsDailyChart.tsx
    ├── AnalyticsPeakChart.tsx
    ├── TopArticlesTable.tsx
    └── TopSourcesTable.tsx
```

---

## Эндпоинты

### POST /api/events (публичный)

Тело запроса — `Blob` с `Content-Type: application/json`:
```json
{ "type": "pageview", "path": "/russia" }
{ "type": "article_click", "articleId": 1234 }
```

IP не сохраняется — вычисляется `daily_hash = SHA256(IP + UA + date).slice(0,16)` и отбрасывается.  
Rate limit: 60 запросов в минуту на IP.

> **Важно:** клиент отправляет через `sendBeacon` с `Blob({ type: 'application/json' })` — без этого Express не парсит тело (`text/plain` игнорируется `express.json()`).

### Admin API (требует Bearer токен)

| Метод | Путь | Параметры | Описание |
|-------|------|-----------|----------|
| GET | `/api/admin/analytics/summary` | `hours=24` | Просмотры, уникальные, клики |
| GET | `/api/admin/analytics/hourly` | `hours=24` | Активность по часам |
| GET | `/api/admin/analytics/daily` | `days=30` | Уникальные визиты по дням |
| GET | `/api/admin/analytics/peak` | `days=7` | Пиковые часы суток |
| GET | `/api/admin/analytics/top-articles` | `hours=24&limit=20` | Топ статей по кликам |
| GET | `/api/admin/analytics/top-sources` | `hours=24` | Топ источников по кликам |

---

## Кабинет мониторинга — Зона D (📈 Аналитика)

Маршрут: `/admin/monitor` → кнопка «📈 Аналитика»  
Polling: каждые 60 сек.

| Блок | Описание |
|------|----------|
| Карточки сводки | Просмотры / Уникальные визиты / Клики за 24ч |
| LineChart | Pageviews + клики по часам за 24ч |
| BarChart | Уникальные визиты по дням за 30 дней |
| BarChart | Пиковые часы активности (среднее за 7 дней) |
| Таблица | Топ 20 новостей по кликам за 24ч |
| Таблица | Топ источников по кликам за 24ч |

---

## Планировщик

| Задача | Расписание | Описание |
|--------|-----------|----------|
| Удаление старых событий | воскресенье 05:00 | `page_events` старше 90 дней → физическое удаление |

---

## Ограничения и оговорки

- **Боты** — `daily_hash` не отличает бота от человека. Косвенный признак бота: много pageview, ноль article_click. Точная фильтрация ботов требует анализа User-Agent (отдельная задача).
- **Точность уникальных визитов** — один пользователь с разных устройств = два хэша. Пользователь сменивший IP = два хэша. Это приблизительная метрика, не точная.
- **sendBeacon и блокировщики** — uBlock Origin и аналоги могут блокировать `/api/events`. Это нормально — статистика будет неполной, но не нулевой.
- **Текст на /about** — уже обновлён: «не собирает персональные данные — только анонимную статистику посещений без возможности идентификации пользователя».
