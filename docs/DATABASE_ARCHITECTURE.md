# База данных — Архитектура

> **Версия:** 2.0.0  
> **PostgreSQL:** 17  
> **ORM:** Drizzle  
> **Схема:** `shared/types/schema.ts`  
> **Последнее обновление:** Май 2025

---

## Обзор таблиц

| Таблица | Назначение | Записей |
|---------|------------|---------|
| `news_sources` | Белый список RSS-источников | ~25 |
| `news_articles` | Собранные статьи с полнотекстовым поиском | ~50k+ |
| `news_clusters` | Группы похожих новостей | ~5k+ |
| `collection_stats` | Статистика каждого цикла сбора | ~50k+ |
| `source_config` | Настройки планировщика и доната | 3 |
| `page_events` | Анонимная аналитика посещений | ~1M+ |
| `article_reactions` | Лайки и дизлайки на статьях | ~10k+ |
| `article_emotions` | Эмодзи-реакции на статьях | ~5k+ |
| `hot_entities` | Горячие сущности за 24ч (топ-100) | ~100 |
| `admin_audit_log` | Аудит административных действий | ~10k+ |
| `admin_tokens` | Токены администраторов (TokenManager) | ~5 |
| `push_subscriptions` | Web Push подписки пользователей | ~N |
| `api_keys` | API-ключи для публичного API | ~N |
| `weather_locations` | Города для модуля погоды | ~N |
| `weather_forecasts` | Дневные прогнозы по городам (7 дней × N городов) | ~7×N |
| `weather_hourly_forecasts` | Почасовые прогнозы (168 часов × N городов) | ~168×N |
| `user_tokens` | Токены доступа к личным кабинетам | ~N |
| `user_channel_subscriptions` | Подписки пользователей на каналы | ~N |
| `user_bookmarks` | Закладки пользователей | ~N |
| `admin_channel_access` | Доступ админов к приватным каналам | ~N |

---

## Схема таблиц

### `news_sources`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | serial PK | |
| `name` | varchar(255) | Отображаемое название |
| `url` | varchar(500) | Сайт источника |
| `rss_url` | varchar(500) | URL RSS-ленты |
| `region` | varchar(20) | `russia` \| `world` |
| `category` | varchar(50) | `economy` \| `tech` \| `politics` \| `society` \| `other` |
| `city` | varchar(100) | Город (для региональных источников, nullable) |
| `source_type` | varchar(20) | `rss` \| `telegram` \| `youtube` (default: `rss`) |
| `is_active` | boolean | Участвует ли в сборе (default: true) |
| `is_featured` | boolean | Бесплатный доступ для всех (default: false) |
| `is_private` | boolean | Приватный канал (доступ через `admin_channel_access`) |
| `username` | varchar(100) | Telegram username (без @) |
| `channel_id` | varchar(100) | YouTube Channel ID |
| `last_fetched_at` | timestamp | Время последнего успешного сбора |
| `description` | text | Описание канала |
| `logo_url` | text | URL логотипа |
| `created_at` | timestamp | |

---

### `news_articles`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | serial PK | |
| `source_id` | integer FK | → `news_sources.id` ON DELETE SET NULL |
| `title` | text NOT NULL | |
| `description` | text | До 500 символов, очищен от HTML |
| `image_url` | text | Из `<enclosure>` или `<media:content>` |
| `url` | text UNIQUE | Дедупликация по URL |
| `published_at` | timestamp NOT NULL | Дата публикации из RSS |
| `fetched_at` | timestamp | Время сбора коллектором |
| `region` | varchar(20) | Наследуется от источника (кроме RBC) |
| `category` | varchar(50) | Наследуется от источника (кроме RBC) |
| `cluster_id` | integer FK | → `news_clusters.id` ON DELETE SET NULL |
| `is_archived` | boolean | default: false |
| `created_at` | timestamp | |
| `search_vector` | tsvector | Триггер `tsvector_update` (BEFORE INSERT OR UPDATE), обновляется только при изменении `title`/`description`, GIN-индекс |
| `entities` | jsonb | `{ PER, ORG, LOC, FIRST }` — NER-сущности заголовка |
| `likes_count` | integer NOT NULL | Денормализованный счётчик, default: 0 |
| `dislikes_count` | integer NOT NULL | Денормализованный счётчик, default: 0 |

**Ключевые особенности:**
- `url UNIQUE` — дедупликация (`INSERT ... ON CONFLICT DO NOTHING`)
- `search_vector` — триггер `tsvector_update` (BEFORE INSERT OR UPDATE) + GIN-индекс. Обновляется только при изменении `title` или `description`
- `entities` — JSONB с GIN-индексом: `{ PER, ORG, LOC, FIRST }`. `FIRST` — первая сущность в заголовке, используется для «Похожих новостей»
- RBC: `region` и `category` переопределяются через `<rbc_news:newsline>` → `RBC_NEWSLINE_MAP`
- `is_archived = true` — статья скрыта из ленты, но доступна через поиск

---

### `news_clusters`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | serial PK | |
| `title` | text | Заголовок первой статьи группы |
| `article_count` | integer | default: 1 |
| `region` | varchar(20) | |
| `category` | varchar(50) | |
| `first_seen_at` | timestamp | |
| `last_seen_at` | timestamp | |

---

### `collection_stats`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | serial PK | |
| `source_id` | integer FK | → `news_sources.id` ON DELETE SET NULL |
| `collected_at` | timestamp NOT NULL | |
| `articles_inserted` | integer | Новых статей вставлено |
| `articles_duplicate` | integer | Отклонено как дубли |
| `fetch_duration_ms` | integer | Время HTTP-запроса к RSS |
| `avg_latency_ms` | integer | Среднее `fetchedAt - publishedAt`. NULL если аномалия |
| `error_count` | integer | |
| `last_error` | text | |

Хранится **7 дней** (воскресенье 04:30).

---

### `source_config`

| Ключ | Значение по умолчанию | Описание |
|------|----------------------|----------|
| `fast_interval_cron` | `* * * * *` | Cron быстрых источников |
| `slow_interval_cron` | `*/5 * * * *` | Cron медленных источников |
| `donate_methods_json` | JSON-массив | Способы оплаты для модалки доната |

Изменения через `PATCH /api/admin/config` без перезапуска.

---

### `page_events`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | serial PK | |
| `type` | varchar(20) NOT NULL | `pageview` \| `article_click` |
| `path` | varchar(500) | Маршрут страницы |
| `article_id` | integer FK | → `news_articles.id` ON DELETE SET NULL |
| `daily_hash` | varchar(16) | SHA256(IP + UA + YYYY-MM-DD)[:16] — IP не хранится |
| `created_at` | timestamp | |

Хранится **90 дней** (воскресенье 05:00).

---

### `article_reactions` / `article_emotions`

`article_reactions` — лайки/дизлайки. `article_emotions` — эмодзи (`smile`, `surprise`, `angry`, `cry`, `sick`). Оба каскадно удаляются со статьёй. Дедупликация по `(article_id, daily_hash)`.

---

### `hot_entities`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | serial PK | |
| `entity_text` | varchar(255) NOT NULL | |
| `entity_type` | varchar(10) NOT NULL | `PER` \| `ORG` \| `LOC` |
| `mention_count` | integer NOT NULL | |
| `period_start` | timestamp NOT NULL | |
| `updated_at` | timestamp NOT NULL | |

Заполняется `HotEntitiesJob` каждый час. Записи старше 48ч удаляются автоматически.

---

### `admin_audit_log`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | varchar(36) PK | UUID |
| `admin_token` | varchar(64) NOT NULL | Хешированный токен |
| `action` | varchar(100) NOT NULL | CREATE, UPDATE, DELETE и др. |
| `resource` | varchar(100) NOT NULL | news_source, config и др. |
| `resource_id` | varchar(50) | |
| `old_value` | jsonb | Состояние до изменения |
| `new_value` | jsonb | Состояние после изменения |
| `ip_address` | varchar(45) NOT NULL | IPv6 support |
| `user_agent` | text | |
| `success` | boolean NOT NULL | |
| `error_message` | text | |
| `timestamp` | timestamp NOT NULL | |

Хранится **6 месяцев**. Очистка: `POST /api/admin/audit/cleanup`.

---

### `admin_tokens`

Управляется `TokenManager`. Создаётся автоматически при инициализации. Хранит хэши токенов администраторов с TTL и grace period при ротации.

---

### `push_subscriptions`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | serial PK | |
| `endpoint` | text UNIQUE NOT NULL | URL push-эндпоинта браузера |
| `p256dh` | text NOT NULL | Публичный ключ шифрования |
| `auth` | text NOT NULL | Секрет аутентификации |
| `created_at` | timestamp NOT NULL | |

Заполняется при подписке пользователя на Web Push. Устаревшие записи (410/404 от push-сервиса) удаляются автоматически при следующей рассылке. Рассылка происходит при `insertedCount >= PUSH_THRESHOLD` (default: 5) в `subscribers.ts`.

---

### `api_keys`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID PK | |
| `key_hash` | varchar(64) UNIQUE NOT NULL | SHA-256 от ключа (сам ключ не хранится) |
| `name` | varchar(100) NOT NULL | Название (Telegram-бот, RSS-ридер и др.) |
| `created_at` | timestamp NOT NULL | |
| `last_used_at` | timestamp | Обновляется при каждом запросе |
| `is_active` | boolean NOT NULL | default: true |
| `requests_per_minute` | integer NOT NULL | default: 60 |
| `requests_per_day` | integer NOT NULL | default: 10000 |

Ключ генерируется с префиксом `na_` + 24 random bytes. Показывается **один раз** при создании. Управление через `GET/POST/DELETE /api/admin/api-keys` (Zone J в кабинете мониторинга). Валидация с Redis-кэшем 5 мин.

---

### `weather_locations`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | serial PK | |
| `name` | varchar(100) | Отображаемое название (RU) |
| `name_en` | varchar(100) | Название для геокодинга / админки |
| `country` | varchar(50) | default `Russia` |
| `latitude` / `longitude` | decimal(8,5) | Координаты для Open-Meteo |
| `timezone` | varchar(50) | IANA TZ |
| `is_active` | boolean | Участвует в публичном списке |
| `sort_order` | integer | Порядок в селекте |
| `created_at` | timestamp | |

Сидирование: `scripts/seed-weather-locations.ts`.

---

### `weather_forecasts`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | serial PK | |
| `location_id` | integer FK | → `weather_locations.id` ON DELETE CASCADE |
| `forecast_date` | date | Уникально в паре с `location_id` |
| `temp_min` / `temp_max` | decimal | °C |
| `precipitation_mm` | decimal | Сумма осадков за день |
| `precipitation_probability_pct` | integer | % вероятность осадков |
| `wind_speed_kmh` | decimal | км/ч средняя скорость ветра |
| `wind_gusts_kmh` | decimal | км/ч порывы ветра |
| `wind_direction_deg` | integer | |
| `humidity_pct` | integer | % влажность |
| `pressure_hpa` | decimal | гПа среднесуточное |
| `weather_code` | integer | WMO / Open-Meteo code |
| `moon_phase` / `moon_phase_name` | decimal / varchar | Луна |
| `kp_index` / `kp_level` | decimal / varchar | Геомагнитная активность |
| `uv_index_max` | decimal | UV-индекс максимальный |
| `fetched_at` | timestamp | |

Дневные строки заполняются фоновым сбором погоды (админ и cron); почасовка для UI запрашивается у Open-Meteo через `GET /api/weather/week` (см. `docs/WEATHER_MODULE_GUIDE.md`).

---

### `weather_hourly_forecasts`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | serial PK | |
| `location_id` | integer FK | → `weather_locations.id` ON DELETE CASCADE |
| `forecast_dt` | timestamp | UTC, уникально в паре с `location_id` |
| `temp` | decimal(4,1) | °C |
| `apparent_temp` | decimal(4,1) | °C ощущаемая |
| `weather_code` | integer | WMO код |
| `wind_speed` | decimal(5,1) | км/ч |
| `wind_gusts` | decimal(5,1) | км/ч порывы ветра |
| `wind_dir` | integer | градусы |
| `precipitation` | decimal(5,1) | мм |
| `pressure_hpa` | decimal(6,1) | гПа |
| `fetched_at` | timestamp | |

**Индексы:**
- `idx_weather_hourly_location_dt` — `(location_id, forecast_dt)`
- `idx_weather_hourly_dt` — `(forecast_dt)`

Почасовые данные заполняются при сборе погоды (каждые 3 часа). Хранятся 10 дней.

---

### `user_tokens`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | serial PK | |
| `token` | varchar(67) UNIQUE | Токен формата `ut_<64 hex>` |
| `label` | varchar(255) | Название токена |
| `is_active` | boolean NOT NULL | default: true |
| `is_admin` | boolean NOT NULL | Админский токен (default: false) |
| `created_at` | timestamp NOT NULL | |
| `expires_at` | timestamp | NULL = бесрочный |
| `last_used_at` | timestamp | Обновляется при каждом запросе |

**Особенности:**
- Админский токен (`is_admin = true`) создаётся автоматически при миграции 0032
- Бесрочный (`expires_at = NULL`)
- Используется для доступа к приватным каналам в `/my`

---

### `user_channel_subscriptions`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | serial PK | |
| `token_id` | integer FK | → `user_tokens.id` ON DELETE CASCADE |
| `source_id` | integer FK | → `news_sources.id` ON DELETE CASCADE |
| `subscribed_at` | timestamp NOT NULL | |

**Особенности:**
- Подписки пользователей на Telegram/YouTube каналы
- Уникальность по `(token_id, source_id)`

---

### `user_bookmarks`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | serial PK | |
| `token_id` | integer FK | → `user_tokens.id` ON DELETE CASCADE |
| `article_id` | integer FK | → `news_articles.id` ON DELETE CASCADE |
| `created_at` | timestamp NOT NULL | |

**Особенности:**
- Закладки пользователей
- Уникальность по `(token_id, article_id)`

---

### `admin_channel_access`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | serial PK | |
| `token_id` | integer FK | → `user_tokens.id` ON DELETE CASCADE |
| `source_id` | integer FK | → `news_sources.id` ON DELETE CASCADE |
| `created_at` | timestamp NOT NULL | |

**Особенности:**
- Связь админских токенов с приватными каналами
- Уникальность по `(token_id, source_id)`
- Приватные каналы (`news_sources.is_private = true`) видны только админам с доступом
- Управление через Zone O в админке

---

## Связи

```
news_sources ──(1:N)──► news_articles ──(N:1)──► news_clusters
     │                       │
     │                       ├──(1:N)──► page_events
     │                       ├──(1:N)──► article_reactions
     │                       └──(1:N)──► article_emotions
     └──(1:N)──► collection_stats

source_config     — ключ-значение
hot_entities      — агрегация NER
admin_audit_log   — аудит
admin_tokens      — токены администраторов
push_subscriptions — Web Push подписки
api_keys          — ключи публичного API
weather_locations — города погоды
weather_forecasts — дневные прогнозы по городам
```

**ON DELETE поведение:**

| FK | Поведение |
|----|-----------|
| `news_articles.source_id` | SET NULL |
| `news_articles.cluster_id` | SET NULL |
| `collection_stats.source_id` | SET NULL |
| `page_events.article_id` | SET NULL |
| `article_reactions.article_id` | CASCADE |
| `article_emotions.article_id` | CASCADE |

---

## Жизненный цикл данных

```
Статьи:
  INSERT (is_archived=false)
    → через 14 дней: is_archived=true  [ежедневно 03:00]
    → через 14 дней: DELETE             [воскресенье 04:00]

Статистика сбора:
  → через 7 дней: DELETE               [воскресенье 04:30]

События аналитики:
  → через 90 дней: DELETE              [воскресенье 05:00]

Аудит:
  → через 6 месяцев: DELETE            [POST /api/admin/audit/cleanup]

Push-подписки:
  → при 410/404 от push-сервиса: DELETE [автоматически при рассылке]
```

---

## Индексы

```sql
-- news_articles
idx_news_articles_published_at
idx_news_articles_region
idx_news_articles_category
idx_news_articles_cluster_id
idx_news_articles_is_archived

-- push_subscriptions
idx_push_subscriptions_created_at

-- api_keys
idx_api_keys_hash
idx_api_keys_active

-- admin_audit_log
idx_admin_audit_log_timestamp
idx_admin_audit_log_action
idx_admin_audit_log_resource
```

---

## Миграции

| Файл | Содержимое |
|------|-----------|
| `drizzle/0001_add_monitor_tables.sql` | `collection_stats`, `source_config` |
| `drizzle/0002_add_page_events.sql` | `page_events` |
| `drizzle/0003_add_search_vector.sql` | `search_vector` GENERATED + GIN |
| `drizzle/0004_add_article_reactions.sql` | `article_reactions` |
| `drizzle/0005_add_reaction_daily_hash.sql` | `daily_hash` в реакциях |
| `drizzle/0006_add_reaction_counts.sql` | `likes_count`, `dislikes_count` |
| `drizzle/0007_sync_reaction_counts.sql` | Пересчёт счётчиков |
| `drizzle/0008_add_article_emotions.sql` | `article_emotions` |
| `drizzle/0009_add_entities.sql` | `entities` JSONB, `hot_entities` |
| `drizzle/0010_admin_audit_log.sql` | `admin_audit_log` |
| `drizzle/0011_add_push_subscriptions.sql` | `push_subscriptions` |
| `drizzle/0012_add_api_keys.sql` | `api_keys` |
| `drizzle/0013_search_vector_trigger.sql` | `search_vector` → триггер `tsvector_update` |
| `drizzle/0014_add_weather.sql` | `weather_locations`, `weather_forecasts` |
| `drizzle/0015_weather_precipitation_probability.sql` | Поле `precipitation_probability_pct` |
| `drizzle/0016_weather_hourly_forecasts.sql` | Таблица `weather_hourly_forecasts` |
| `drizzle/0017_weather_apparent_temp.sql` | Поле `apparent_temp` в почасовке |
| `drizzle/0018_weather_uv_index.sql` | Поле `uv_index_max` в дневных прогнозах |
| `drizzle/0019_add_wind_gusts.sql` | Поля `wind_gusts_kmh` (дневные), `wind_gusts` (почасовка) |
| `drizzle/0020_analytics_enhancements.sql` | Добавление `city`, `device_type`, `referrer_domain` в `page_events` |
| `drizzle/0021_telegram_integration.sql` | Интеграция Telegram-каналов |
| `drizzle/0026_user_tokens.sql` | Таблица `user_tokens` для личных кабинетов |
| `drizzle/0027_fix_user_token_length.sql` | Исправление длины токена (67 символов) |
| `drizzle/0028_add_is_featured.sql` | Поле `is_featured` в `news_sources` |
| `drizzle/0029_add_user_bookmarks.sql` | Таблица `user_bookmarks` |
| `drizzle/0030_link_push_to_token.sql` | Связь `push_subscriptions.token_id` → `user_tokens.id` |
| `drizzle/0031_add_channel_identifiers.sql` | Поля `username`, `channel_id` в `news_sources` |
| `drizzle/0032_admin_private_channels.sql` | Система админских приватных каналов |

```bash
npx drizzle-kit migrate    # применить миграции
npx drizzle-kit generate   # сгенерировать из изменений схемы
npx drizzle-kit studio     # веб-интерфейс для просмотра БД
```

---

## Кэширование

Двухуровневое: Redis → in-memory fallback.

| Ключ кэша | TTL | Инвалидация |
|-----------|-----|-------------|
| `news:list:*` | 300 с | `invalidateByTags(['news'])` после сбора |
| `news:cluster:*` | 300 с | то же |
| `news:sources` | 600 с | — |
| `news:cities` | 3600 с | — |
| `news:popular` | 300 с | — |
| `news:top-liked` | 300 с | после каждого лайка |
| `apikey:{hash}` | 300 с | при отзыве ключа |
| `weather:week:{locationId}` | 3600 с | тег `weather`, через `advancedCache` |
| `weather:locations` | 3600 с | тег `weather` |

`/api/news/search`, `/api/news/reaction-counts`, `/api/events` — без кэша.

---

## Подключение

```
Pool: max=10, min=2, idleTimeout=10s, connectionTimeout=2s
DATABASE_URL=postgres://user:password@localhost:5432/news_aggregator
```
