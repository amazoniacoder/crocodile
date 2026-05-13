# Database Schema

> Версия: 1.0  
> Создан: Май 2025  
> PostgreSQL 17 + Drizzle ORM

---

## ER-диаграмма

```mermaid
erDiagram
    news_sources ||--o{ news_articles : "source_id"
    news_sources ||--o{ collection_stats : "source_id"
    news_clusters ||--o{ news_articles : "cluster_id"
    news_articles ||--o{ page_events : "article_id"
    news_articles ||--o{ article_reactions : "article_id"
    news_articles ||--o{ article_emotions : "article_id"
    weather_locations ||--o{ weather_forecasts : "location_id"
    weather_locations ||--o{ weather_hourly_forecasts : "location_id"

    news_sources {
        serial id PK
        varchar name
        varchar url
        varchar rss_url
        varchar region "russia | world"
        varchar category "economy | tech | politics | society | other"
        varchar city "nullable"
        boolean is_active
        timestamp last_fetched_at
        timestamp created_at
    }

    news_articles {
        serial id PK
        integer source_id FK "SET NULL"
        text title
        text description
        text image_url
        text url "UNIQUE"
        timestamp published_at
        timestamp fetched_at
        varchar region
        varchar category
        integer cluster_id FK "SET NULL"
        boolean is_archived
        timestamp created_at
        tsvector search_vector "GIN index, trigger"
        jsonb entities "GIN index, {PER, ORG, LOC, FIRST}"
        integer likes_count
        integer dislikes_count
    }

    news_clusters {
        serial id PK
        text title
        integer article_count
        varchar region
        varchar category
        timestamp first_seen_at
        timestamp last_seen_at
    }

    collection_stats {
        serial id PK
        integer source_id FK "SET NULL"
        timestamp collected_at
        integer articles_inserted
        integer articles_duplicate
        integer fetch_duration_ms
        integer avg_latency_ms
        integer error_count
        text last_error
    }

    source_config {
        varchar key PK
        text value
        timestamp updated_at
    }

    page_events {
        serial id PK
        varchar type "pageview | article_click"
        varchar path
        integer article_id FK "SET NULL"
        varchar daily_hash "SHA256(IP+UA+date)[:16]"
        timestamp created_at
    }

    article_reactions {
        serial id PK
        integer article_id FK "CASCADE"
        varchar reaction_type "like | dislike"
        varchar daily_hash
        timestamp created_at
    }

    article_emotions {
        serial id PK
        integer article_id FK "CASCADE"
        varchar emotion_type "smile | surprise | angry | cry | sick"
        varchar daily_hash
        timestamp created_at
    }

    hot_entities {
        serial id PK
        varchar entity_text
        varchar entity_type "PER | ORG | LOC"
        integer mention_count
        timestamp period_start
        timestamp updated_at
    }

    admin_audit_log {
        varchar id PK "UUID"
        varchar admin_token
        varchar action
        varchar resource
        varchar resource_id
        jsonb old_value
        jsonb new_value
        varchar ip_address
        text user_agent
        boolean success
        text error_message
        timestamp timestamp
    }

    admin_tokens {
        varchar id PK "UUID"
        varchar token_hash "bcrypt"
        varchar name
        timestamp expires_at
        boolean is_active
        timestamp created_at
        timestamp last_used_at
    }

    push_subscriptions {
        serial id PK
        text endpoint "UNIQUE"
        text p256dh
        text auth
        timestamp created_at
    }

    api_keys {
        varchar id PK "UUID"
        varchar key_hash "SHA-256, UNIQUE"
        varchar name
        timestamp created_at
        timestamp last_used_at
        boolean is_active
        integer requests_per_minute
        integer requests_per_day
    }

    weather_locations {
        serial id PK
        varchar name "RU"
        varchar name_en
        varchar country
        decimal latitude
        decimal longitude
        varchar timezone "IANA"
        boolean is_active
        integer sort_order
        timestamp created_at
    }

    weather_forecasts {
        serial id PK
        integer location_id FK "CASCADE"
        date forecast_date "UNIQUE with location_id"
        decimal temp_min
        decimal temp_max
        decimal precipitation_mm
        integer precipitation_probability_pct
        decimal wind_speed_kmh
        decimal wind_gusts_kmh
        integer wind_direction_deg
        integer humidity_pct
        decimal pressure_hpa
        integer weather_code "WMO"
        decimal moon_phase
        varchar moon_phase_name
        decimal kp_index
        varchar kp_level
        decimal uv_index_max
        timestamp fetched_at
    }

    weather_hourly_forecasts {
        serial id PK
        integer location_id FK "CASCADE"
        timestamp forecast_dt "UTC, UNIQUE with location_id"
        decimal temp
        decimal apparent_temp
        integer weather_code "WMO"
        decimal wind_speed
        decimal wind_gusts
        integer wind_dir
        decimal precipitation
        decimal pressure_hpa
        timestamp fetched_at
    }
```

---

## Индексы и триггеры

### Индексы

```sql
-- news_articles
CREATE INDEX idx_news_articles_published_at ON news_articles(published_at);
CREATE INDEX idx_news_articles_region ON news_articles(region);
CREATE INDEX idx_news_articles_category ON news_articles(category);
CREATE INDEX idx_news_articles_cluster_id ON news_articles(cluster_id);
CREATE INDEX idx_news_articles_is_archived ON news_articles(is_archived);
CREATE INDEX idx_news_articles_search_vector ON news_articles USING GIN(search_vector);
CREATE INDEX idx_news_articles_entities ON news_articles USING GIN(entities);

-- push_subscriptions
CREATE INDEX idx_push_subscriptions_created_at ON push_subscriptions(created_at);

-- api_keys
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- admin_audit_log
CREATE INDEX idx_admin_audit_log_timestamp ON admin_audit_log(timestamp);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_admin_audit_log_resource ON admin_audit_log(resource);

-- weather_hourly_forecasts
CREATE INDEX idx_weather_hourly_location_dt ON weather_hourly_forecasts(location_id, forecast_dt);
CREATE INDEX idx_weather_hourly_dt ON weather_hourly_forecasts(forecast_dt);
```

### Триггер полнотекстового поиска

```sql
CREATE OR REPLACE FUNCTION tsvector_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Обновляем search_vector только если изменились title или description
  IF TG_OP = 'INSERT' OR 
     (TG_OP = 'UPDATE' AND (OLD.title IS DISTINCT FROM NEW.title OR OLD.description IS DISTINCT FROM NEW.description)) THEN
    NEW.search_vector := 
      setweight(to_tsvector('russian', COALESCE(NEW.title, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
      setweight(to_tsvector('russian', COALESCE(NEW.description, '')), 'B') ||
      setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvector_update_trigger
BEFORE INSERT OR UPDATE ON news_articles
FOR EACH ROW
EXECUTE FUNCTION tsvector_update();
```

**Особенности:**
- Триггер срабатывает только при изменении `title` или `description`
- Двуязычная индексация (русский + английский)
- Веса: заголовок (A), описание (B)
- GIN-индекс для быстрого поиска

---

## Жизненный цикл данных

```mermaid
gantt
    title Жизненный цикл статьи
    dateFormat X
    axisFormat %s

    section Статья
    Активна (is_archived=false)           :active, 0, 14d
    Архивирована (is_archived=true)       :crit, 14d, 28d
    Удалена                               :done, 28d, 30d

    section Статистика сбора
    Хранится                              :active, 0, 7d
    Удалена                               :done, 7d, 8d

    section События аналитики
    Хранятся                              :active, 0, 90d
    Удалены                               :done, 90d, 91d

    section Аудит
    Хранится                              :active, 0, 180d
    Удаляется вручную                     :milestone, 180d, 0d
```

### Расписание очистки

| Время | Задача | Таблица |
|-------|--------|---------|
| Ежедневно 03:00 | Архивирование статей старше 14 дней | `news_articles` SET `is_archived=true` |
| Воскресенье 04:00 | Удаление архивных статей старше 14 дней | `news_articles` DELETE |
| Воскресенье 04:30 | Удаление статистики старше 7 дней | `collection_stats` DELETE |
| Воскресенье 05:00 | Удаление событий старше 90 дней | `page_events` DELETE |
| Воскресенье 06:00 | Очистка погоды (>14 дней дневные, >10 дней почасовка) | `weather_forecasts`, `weather_hourly_forecasts` DELETE |
| По запросу | Очистка аудита старше N дней | `admin_audit_log` DELETE |

---

## Связи и каскады

```mermaid
graph TD
    A[news_sources] -->|SET NULL| B[news_articles]
    A -->|SET NULL| C[collection_stats]
    D[news_clusters] -->|SET NULL| B
    B -->|SET NULL| E[page_events]
    B -->|CASCADE| F[article_reactions]
    B -->|CASCADE| G[article_emotions]
    H[weather_locations] -->|CASCADE| I[weather_forecasts]
    H -->|CASCADE| J[weather_hourly_forecasts]
```

### ON DELETE поведение

| FK | Поведение | Причина |
|----|-----------|---------|
| `news_articles.source_id` | SET NULL | Статья остаётся при удалении источника |
| `news_articles.cluster_id` | SET NULL | Статья остаётся при удалении кластера |
| `collection_stats.source_id` | SET NULL | Статистика остаётся для анализа |
| `page_events.article_id` | SET NULL | События остаются для аналитики |
| `article_reactions.article_id` | CASCADE | Реакции удаляются со статьёй |
| `article_emotions.article_id` | CASCADE | Эмоции удаляются со статьёй |
| `weather_forecasts.location_id` | CASCADE | Прогнозы удаляются с городом |
| `weather_hourly_forecasts.location_id` | CASCADE | Почасовка удаляется с городом |

---

## Особенности таблиц

### news_articles

**Дедупликация:**
```sql
INSERT INTO news_articles (url, title, ...)
VALUES ($1, $2, ...)
ON CONFLICT (url) DO NOTHING;
```

**Полнотекстовый поиск:**
```sql
SELECT * FROM news_articles
WHERE search_vector @@ plainto_tsquery('russian', 'Трамп санкции')
ORDER BY ts_rank(search_vector, plainto_tsquery('russian', 'Трамп санкции')) DESC;
```

**Entity-поиск:**
```sql
SELECT * FROM news_articles
WHERE entities @> '{"PER": ["Трамп"]}'::jsonb
  AND published_at >= NOW() - INTERVAL '48 hours';
```

**Структура entities:**
```json
{
  "PER": ["Трамп", "Путин"],
  "ORG": ["Газпром", "ООН"],
  "LOC": ["Россия", "США"],
  "FIRST": "Трамп"
}
```

`FIRST` — первая сущность в заголовке, используется для «Похожих новостей».

---

### source_config

Ключ-значение для настроек без перезапуска:

```sql
SELECT value FROM source_config WHERE key = 'fast_interval_cron';
-- '* * * * *'

UPDATE source_config SET value = '*/2 * * * *' WHERE key = 'fast_interval_cron';
```

Изменения подхватываются `ScheduleManagementService` через EventBus.

---

### page_events

**Анонимизация:**
```typescript
const dailyHash = crypto
  .createHash('sha256')
  .update(`${ip}${userAgent}${YYYY-MM-DD}`)
  .digest('hex')
  .slice(0, 16);
```

IP не хранится. Хэш меняется каждый день → невозможно отследить пользователя между днями.

---

### api_keys

**Генерация ключа:**
```typescript
const key = `na_${crypto.randomBytes(24).toString('hex')}`;
const keyHash = crypto.createHash('sha256').update(key).digest('hex');
// Сохраняем только keyHash, key показываем один раз
```

**Валидация с кэшем:**
```typescript
// Redis: apikey:{hash} → {id, name, requests_per_minute}
// TTL: 5 минут
```

---

### weather_forecasts / weather_hourly_forecasts

**Дневные прогнозы:**
- 7 дней вперёд
- Обновляются каждые 3 часа
- Хранятся 14 дней

**Почасовые прогнозы:**
- 2 дня (48 часов)
- Обновляются каждые 3 часа
- Хранятся 10 дней

**Запрос недели с почасовкой:**
```sql
SELECT 
  wf.*,
  (
    SELECT json_agg(whf.* ORDER BY whf.forecast_dt)
    FROM weather_hourly_forecasts whf
    WHERE whf.location_id = wf.location_id
      AND whf.forecast_dt >= wf.forecast_date::timestamp
      AND whf.forecast_dt < (wf.forecast_date + INTERVAL '1 day')::timestamp
  ) AS hourly
FROM weather_forecasts wf
WHERE wf.location_id = $1
  AND wf.forecast_date >= CURRENT_DATE
ORDER BY wf.forecast_date
LIMIT 7;
```

---

## Миграции

Применение:
```bash
npx drizzle-kit migrate
```

Генерация новой миграции:
```bash
npx drizzle-kit generate
```

Просмотр схемы:
```bash
npx drizzle-kit studio
```

### История миграций

| Миграция | Описание |
|----------|----------|
| 0001 | Базовые таблицы (sources, articles, clusters) |
| 0002 | Аналитика (page_events) |
| 0003 | Полнотекстовый поиск (search_vector GENERATED) |
| 0004 | Реакции (article_reactions) |
| 0005 | Анонимизация реакций (daily_hash) |
| 0006 | Денормализация счётчиков (likes_count, dislikes_count) |
| 0007 | Синхронизация счётчиков |
| 0008 | Эмоции (article_emotions) |
| 0009 | NER (entities JSONB, hot_entities) |
| 0010 | Аудит (admin_audit_log) |
| 0011 | Web Push (push_subscriptions) |
| 0012 | API-ключи (api_keys) |
| 0013 | Триггер search_vector (замена GENERATED) |
| 0014 | Погода (weather_locations, weather_forecasts) |
| 0015 | Вероятность осадков (precipitation_probability_pct) |
| 0016 | Почасовая погода (weather_hourly_forecasts) |
| 0017 | Ощущаемая температура (apparent_temp) |
| 0018 | UV-индекс (uv_index_max) |
| 0019 | Порывы ветра (wind_gusts_kmh, wind_gusts) |

---

## Подключение

```env
DATABASE_URL=postgres://user:password@localhost:5432/news_aggregator
```

**Connection Pool:**
- max: 10
- min: 2
- idleTimeout: 10s
- connectionTimeout: 2s

---

> См. также: [DATABASE_ARCHITECTURE.md](../DATABASE_ARCHITECTURE.md), [DATA_FLOW.md](./DATA_FLOW.md), [C4_ARCHITECTURE.md](./C4_ARCHITECTURE.md)
