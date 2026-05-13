# Performance Guide

> Версия: 1.0  
> Создан: Май 2025

---

## Когда нужен Redis

### Production (обязательно)

**Причины:**
- Кэш персистентный между перезапусками
- Кластер: общий кэш для всех нод
- Rate limiting: счётчики сохраняются
- Distributed locks для планировщика

**Метрики:**
- > 1000 req/мин
- > 2 ноды в кластере
- Uptime > 99%

### Development (опционально)

**Можно обойтись in-memory:**
- Single instance
- < 100 req/мин
- Кэш теряется при перезапуске — не критично

**Запуск Redis локально:**
```bash
# Windows
redis-server

# Docker
docker run -d -p 6379:6379 redis:7

# Docker Compose
docker-compose up -d redis
```

---

## Оптимизация БД

### Индексы

**Обязательные (уже созданы):**
```sql
CREATE INDEX idx_news_articles_published_at ON news_articles(published_at);
CREATE INDEX idx_news_articles_region ON news_articles(region);
CREATE INDEX idx_news_articles_category ON news_articles(category);
CREATE INDEX idx_news_articles_cluster_id ON news_articles(cluster_id);
CREATE INDEX idx_news_articles_is_archived ON news_articles(is_archived);
CREATE INDEX idx_news_articles_search_vector ON news_articles USING GIN(search_vector);
CREATE INDEX idx_news_articles_entities ON news_articles USING GIN(entities);
```

**Проверка использования:**
```sql
EXPLAIN ANALYZE
SELECT * FROM news_articles
WHERE region = 'russia' AND is_archived = false
ORDER BY published_at DESC
LIMIT 20;

-- Должно быть:
-- Index Scan using idx_news_articles_published_at
-- Filter: (region = 'russia' AND is_archived = false)
```

### VACUUM

**Регулярная очистка:**
```bash
# Ручная очистка
psql $DATABASE_URL -c "VACUUM ANALYZE news_articles;"

# Автоматическая (настроено в PostgreSQL)
# autovacuum = on
# autovacuum_naptime = 1min
```

**Когда запускать:**
- После массового удаления (воскресенье 04:00 — удаление архивных статей)
- При деградации производительности
- Раз в неделю профилактически

### Connection Pool

**Настройки (уже оптимизированы):**
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,           // Максимум подключений
  min: 2,            // Минимум подключений
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 2000
});
```

**Мониторинг:**
```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'news_aggregator';
-- Должно быть < 10
```

### Партиционирование (будущее)

Для таблиц > 10M записей:
```sql
-- Партиционирование news_articles по published_at (по месяцам)
CREATE TABLE news_articles_2025_05 PARTITION OF news_articles
FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
```

---

## Кэширование

### Двухуровневый кэш

```
Request → QueryCacheService
  ↓
Redis (primary)
  ↓ (если недоступен)
In-Memory (fallback)
  ↓ (если промах)
Database
```

**Преимущества:**
- Redis недоступен → система работает
- In-memory быстрее Redis (нет сериализации)
- Персистентность Redis для кластера

### TTL стратегии

| Эндпоинт | TTL | Stale-while-revalidate | Причина |
|----------|-----|------------------------|---------|
| `/api/news` | 300s | 60s | Лента обновляется каждые 1-5 минут |
| `/api/news/search` | 120s | — | Поиск — динамический запрос |
| `/api/news/sources` | 3600s | — | Источники меняются редко |
| `/api/news/cities` | 3600s | — | Города статичны |
| `/api/weather/week` | 3600s | — | Погода обновляется каждые 3 часа |
| `/api/weather/locations` | 3600s | — | Города статичны |

**Stale-while-revalidate:**
```
TTL истёк → отдать stale данные → фоновое обновление
```

### Тегированная инвалидация

```typescript
// Сохранение с тегами
queryCacheService.set(key, data, { ttl: 300, tags: ['news'] });

// Инвалидация по тегу
queryCacheService.invalidateByTags(['news']);
// Удаляет все ключи с тегом 'news'
```

**Теги:**
- `news` — лента, детали статей
- `clusters` — кластеры
- `weather` — погода

**Триггеры инвалидации:**
- `articles.collected` → `['news']`
- `cluster.updated` → `['news', 'clusters']`
- `weather.collected` → `['weather']`

### Кэш-статистика

```bash
curl http://localhost:5000/api/admin/monitoring/cache-stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Метрики:**
- `hitRate` — должен быть > 80%
- `missRate` — должен быть < 20%
- `evictionRate` — должен быть < 5%

**Оптимизация:**
- Hit rate < 80% → увеличить TTL
- Eviction rate > 5% → увеличить maxSize in-memory кэша

---

## Rate Limiting

### Стратегия

**Без API-ключа:**
- 120 req/мин по IP
- Sliding window (express-rate-limit)

**С API-ключом:**
- Лимит из таблицы `api_keys.requests_per_minute`
- Default: 60 req/мин
- Можно настроить индивидуально

### LRU-кэш лимитеров

```typescript
// MAX_RATE_LIMITERS — максимум активных лимитеров
// Default: 1000
// При превышении — LRU-очистка (удаляются старые)
```

**Мониторинг:**
```bash
curl http://localhost:5000/api/admin/monitoring/rate-limiters \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Метрики:**
- `activeLimiters` — текущее количество
- `maxLimiters` — лимит (из .env)
- `utilizationPercent` — должен быть < 80%
- `lruEvictions` — количество вытесненных

**Оптимизация:**
- Utilization > 80% → увеличить `MAX_RATE_LIMITERS` в .env
- LRU evictions > 100/час → увеличить `MAX_RATE_LIMITERS`

---

## NER Батчинг

### Настройки

```typescript
// server/infrastructure/ner/NerService.ts
const BATCH_SIZE = 10;  // Заголовков в одном запросе
const TIMEOUT_MS = 5000; // Таймаут запроса
```

**Оптимизация:**
- 200 статей = 20 HTTP-запросов к NER
- Batch size 10 — оптимально для баланса скорость/надёжность
- Увеличение до 20 → меньше запросов, но выше риск таймаута

### Circuit Breaker

```typescript
// GracefulNerService
// При 5 ошибках подряд → открыть circuit на 60 секунд
// Статьи сохраняются с entities = null
```

**Мониторинг:**
```bash
curl http://localhost:5000/api/admin/ner/health \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Метрики:**
- `circuitState` — closed (норма), open (деградация)
- `failureCount` — должен быть < 5
- `lastError` — последняя ошибка

---

## Виртуализация ленты

### @tanstack/react-virtual

```typescript
// client/src/components/news/NewsFeed.tsx
const virtualizer = useVirtualizer({
  count: articles.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 200,  // Примерная высота карточки
  overscan: 5               // Рендерить 5 элементов за пределами viewport
});
```

**Преимущества:**
- Рендерится только видимые карточки + overscan
- 1000 статей → рендерится ~20 карточек
- Плавный скролл без лагов

**Оптимизация:**
- `overscan: 5` — баланс между плавностью и производительностью
- Увеличение до 10 → плавнее, но больше DOM-нод
- Уменьшение до 2 → меньше DOM-нод, но видны "прыжки" при скролле

---

## Офлайн GC

### Настройки

```typescript
// client/src/services/offlineStore.ts
const MAX_ARTICLES = 3000;  // Лимит статей в IDB
const TTL_DAYS = 14;        // Время жизни статьи
```

**Триггеры GC:**
- При сохранении новой статьи (если превышен лимит)
- Ручная очистка: /about → «Очистить офлайн-данные»

**Стратегия:**
1. Удалить статьи старше TTL_DAYS
2. Если всё ещё > MAX_ARTICLES → удалить самые старые

**Мониторинг:**
```javascript
// DevTools → Application → IndexedDB → news-aggregator-offline → articles
// Смотреть количество записей
```

**Оптимизация:**
- MAX_ARTICLES 3000 — ~15 MB в IDB
- Увеличение до 5000 → больше офлайн-контента, но медленнее GC
- Уменьшение до 1000 → быстрее GC, но меньше офлайн-контента

---

## Погода кэш

### Клиентский кэш (IndexedDB)

```typescript
// client/src/services/weatherCache.ts
const TTL_HOURS = 1;  // Время жизни недели погоды
const GC_DAYS = 7;    // Удалять записи старше 7 дней
```

**Стратегия:**
1. Запрос `/api/weather/week` → сохранить в IDB
2. Следующий запрос → проверить TTL
3. Если TTL истёк → запросить API, обновить IDB
4. Офлайн → отдать из IDB (даже если TTL истёк)

**Оптимизация:**
- TTL 1 час — баланс между свежестью и нагрузкой на API
- Увеличение до 3 часов → меньше запросов, но менее свежие данные
- GC 7 дней — достаточно для истории

### Серверный кэш (Redis)

```typescript
// server/api/weather/index.ts
advancedCache.middleware('weather:week', { ttl: 3600 })
```

**Инвалидация:**
```typescript
// После сбора погоды
advancedCache.invalidate('weather:*');
```

---

## Метрики производительности

### Целевые значения

| Метрика | Цель | Критично |
|---------|------|----------|
| API Latency (p95) | < 200ms | < 500ms |
| API Latency (p99) | < 500ms | < 1000ms |
| Cache Hit Rate | > 80% | > 60% |
| Database Query Time (p95) | < 50ms | < 100ms |
| RSS Collection Time | < 30s | < 60s |
| NER Batch Time | < 2s | < 5s |
| WebSocket Latency | < 100ms | < 500ms |
| Web Push Delivery | < 5s | < 30s |

### Мониторинг

```bash
# SLA метрики
curl http://localhost:5000/api/admin/sla/metrics \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Здоровье системы
curl http://localhost:5000/api/admin/monitoring/health \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Оптимизация запросов

### Пагинация

```typescript
// Всегда используйте LIMIT + OFFSET
SELECT * FROM news_articles
WHERE region = 'russia'
ORDER BY published_at DESC
LIMIT 20 OFFSET 0;
```

**Не делайте:**
```typescript
// ❌ Загрузка всех статей
SELECT * FROM news_articles;

// ❌ Offset > 1000 (медленно)
SELECT * FROM news_articles LIMIT 20 OFFSET 5000;
```

### Фильтрация

```typescript
// ✅ Используйте индексы
WHERE region = 'russia' AND is_archived = false

// ❌ Функции в WHERE (не используют индекс)
WHERE LOWER(region) = 'russia'
```

### JOIN

```typescript
// ✅ LEFT JOIN для опциональных связей
SELECT a.*, s.name AS source_name
FROM news_articles a
LEFT JOIN news_sources s ON a.source_id = s.id;

// ❌ Множественные JOIN без необходимости
```

---

## Профилирование

### Node.js

```bash
# Запуск с профилировщиком
node --prof server/index.js

# Анализ
node --prof-process isolate-*.log > profile.txt
```

### PostgreSQL

```sql
-- Включить логирование медленных запросов
ALTER DATABASE news_aggregator SET log_min_duration_statement = 100;

-- Просмотр логов
SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
```

### Redis

```bash
# Мониторинг команд в реальном времени
redis-cli MONITOR

# Статистика
redis-cli INFO stats
```

---

## Чеклист оптимизации

### Перед деплоем

- [ ] Все индексы созданы
- [ ] VACUUM выполнен
- [ ] Redis запущен и доступен
- [ ] Connection pool настроен (max: 10)
- [ ] Rate limiting включен
- [ ] Кэш TTL настроен
- [ ] NER batch size оптимален (10)
- [ ] Офлайн GC настроен (3000 статей, 14 дней)

### После деплоя

- [ ] Cache hit rate > 80%
- [ ] API latency p95 < 200ms
- [ ] Database query time p95 < 50ms
- [ ] RSS collection time < 30s
- [ ] Нет memory leaks (проверить через `process.memoryUsage()`)
- [ ] Нет долгих запросов (> 1s в логах PostgreSQL)

---

> См. также: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
