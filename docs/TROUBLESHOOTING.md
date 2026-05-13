# Troubleshooting Guide

> Версия: 1.0  
> Создан: Май 2025

---

## NER-сервис недоступен

### Симптомы
- Статьи сохраняются с `entities = null`
- В логах: `NER service unavailable, skipping entity extraction`
- Блок «Похожие новости» использует только cluster fallback

### Проверка

```bash
# Проверить доступность
curl http://localhost:8001/health
# Ожидается: {"ok":true}

# Проверить извлечение
curl -X POST http://localhost:8001/extract \
  -H "Content-Type: application/json" \
  -d '{"texts": ["Трамп подписал указ"]}'
# Ожидается: [{"PER":["Трамп"],"ORG":[],"LOC":[]}]
```

### Решение

**Локальный запуск:**
```bash
cd D:\BlogPro\ner-service
pip install fastapi uvicorn natasha pymorphy2
uvicorn main:app --host 0.0.0.0 --port 8001
```

**Docker:**
```bash
docker-compose up -d --build ner-service
```

**Проверить .env:**
```env
NER_SERVICE_URL=http://localhost:8001  # локально
NER_SERVICE_URL=http://ner-service:8001  # Docker
```

### Деградация

Система продолжает работать без NER:
- Статьи сохраняются с `entities = null`
- Entity-поиск пропускается
- Cluster fallback работает (токенная кластеризация)
- Category fallback работает

---

## Redis упал

### Симптомы
- В логах: `Redis connection error`
- Кэш работает медленнее (fallback на in-memory)
- Rate limiting работает, но не персистентный

### Проверка

```bash
# Проверить доступность
redis-cli ping
# Ожидается: PONG

# Проверить подключение из приложения
curl http://localhost:5000/api/admin/monitoring/health \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Смотреть redis.status
```

### Решение

**Запустить Redis:**
```bash
# Windows
redis-server

# Docker
docker-compose up -d redis
```

**Проверить .env:**
```env
REDIS_URL=redis://localhost:6379
```

### Fallback на in-memory

Система автоматически переключается на in-memory кэш:
- `QueryCacheService` использует Map вместо Redis
- TTL работает через setTimeout
- Кэш не персистентный (теряется при перезапуске)
- Rate limiting работает, но счётчики не сохраняются

**Проверка режима:**
```bash
curl http://localhost:5000/api/admin/monitoring/cache-stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Смотреть redis.connected: false
```

---

## Миграции не применились

### Симптомы
- Ошибка при старте: `relation "news_articles" does not exist`
- Ошибка: `column "entities" does not exist`

### Проверка

```bash
# Проверить версию схемы
psql $DATABASE_URL -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5;"
```

### Решение

**Применить миграции:**
```bash
npx drizzle-kit migrate
```

**Если миграция зависла:**
```bash
# Откатить последнюю миграцию вручную
psql $DATABASE_URL -c "DELETE FROM drizzle.__drizzle_migrations WHERE id = (SELECT id FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1);"

# Применить заново
npx drizzle-kit migrate
```

**Если таблица drizzle.__drizzle_migrations не существует:**
```bash
# Создать вручную
psql $DATABASE_URL -c "CREATE SCHEMA IF NOT EXISTS drizzle;"
psql $DATABASE_URL -c "CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at BIGINT);"

# Применить миграции
npx drizzle-kit migrate
```

---

## WebSocket не подключается

### Симптомы
- В консоли браузера: `WebSocket connection failed`
- Нет real-time уведомлений о новых статьях

### Проверка

```bash
# Проверить WebSocket эндпоинт
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:5000/ws
# Ожидается: 101 Switching Protocols
```

### Решение

**Nginx конфигурация:**
```nginx
location /ws {
  proxy_pass http://localhost:5000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_cache_bypass $http_upgrade;
}
```

**CORS:**
```typescript
// server/index.ts
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
```

**Проверить порт:**
```env
PORT=5000
```

---

## Web Push не работает

### Симптомы
- Кнопка «Включить уведомления» не появляется
- Push не приходят после подписки
- В консоли: `Push API not supported`

### Проверка

**1. HTTPS:**
Web Push работает только через HTTPS (или localhost).

**2. VAPID-ключи:**
```bash
# Проверить .env
echo $VAPID_PUBLIC_KEY
echo $VAPID_PRIVATE_KEY

# Если пусто — сгенерировать
npx web-push generate-vapid-keys
```

**3. Service Worker:**
```javascript
// DevTools → Application → Service Workers
// Должен быть зарегистрирован и активен
```

**4. Разрешения:**
```javascript
// DevTools → Console
Notification.permission
// Ожидается: "granted"
```

### Решение

**Сгенерировать VAPID-ключи:**
```bash
npx web-push generate-vapid-keys
# Вставить в .env:
# VAPID_PUBLIC_KEY=...
# VAPID_PRIVATE_KEY=...
# VAPID_SUBJECT=mailto:admin@example.com
```

**Перезапустить сервер:**
```bash
npm run dev
```

**Очистить Service Worker:**
```
DevTools → Application → Service Workers → Unregister
Перезагрузить страницу
```

**Проверить подписку:**
```bash
curl http://localhost:5000/api/push/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Смотреть subscriptions > 0
```

---

## Кластеризация не срабатывает

### Симптомы
- Все статьи имеют `cluster_id = null`
- В логах нет сообщений о кластеризации

### Проверка

```bash
# Проверить EventBus
# В логах должно быть:
# "EventBus: articles.collected emitted"
# "ClusterNewsUseCase: starting clustering"

# Проверить статьи без кластера
psql $DATABASE_URL -c "SELECT COUNT(*) FROM news_articles WHERE cluster_id IS NULL AND published_at >= NOW() - INTERVAL '7 days';"
```

### Решение

**Проверить подписку на EventBus:**
```typescript
// server/application/news/subscribers.ts
eventBus.on('articles.collected', async (data) => {
  await clusterNewsUseCase.execute();
});
```

**Запустить кластеризацию вручную:**
```bash
curl -X POST http://localhost:5000/api/admin/jobs/cluster \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Проверить NER-сервис:**
Кластеризация использует NER для нормализации заголовков. Если NER недоступен, используется fallback на сырые токены.

```bash
curl http://localhost:8001/health
```

---

## Медленная лента

### Симптомы
- GET /api/news отвечает > 1 секунды
- В логах: `X-Cache: MISS`

### Проверка

```bash
# Проверить кэш
curl -I http://localhost:5000/api/news
# Смотреть X-Cache: HIT или MISS

# Проверить Redis
redis-cli INFO stats
# Смотреть keyspace_hits / keyspace_misses

# Проверить индексы БД
psql $DATABASE_URL -c "SELECT schemaname, tablename, indexname FROM pg_indexes WHERE tablename = 'news_articles';"
```

### Решение

**1. Проверить Redis:**
```bash
redis-cli ping
# Если не отвечает — запустить Redis
```

**2. Прогреть кэш:**
```bash
curl http://localhost:5000/api/news?region=russia
curl http://localhost:5000/api/news?region=world
curl http://localhost:5000/api/news?category=tech
```

**3. Проверить индексы:**
```sql
-- Должны быть индексы:
CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON news_articles(published_at);
CREATE INDEX IF NOT EXISTS idx_news_articles_region ON news_articles(region);
CREATE INDEX IF NOT EXISTS idx_news_articles_category ON news_articles(category);
CREATE INDEX IF NOT EXISTS idx_news_articles_is_archived ON news_articles(is_archived);
```

**4. EXPLAIN ANALYZE:**
```sql
EXPLAIN ANALYZE
SELECT * FROM news_articles
WHERE region = 'russia' AND is_archived = false
ORDER BY published_at DESC
LIMIT 20;
```

**5. VACUUM:**
```bash
psql $DATABASE_URL -c "VACUUM ANALYZE news_articles;"
```

---

## Офлайн-режим не работает

### Симптомы
- При отключении сети лента не загружается
- Индикатор не показывает офлайн-статус
- В консоли: `Failed to fetch`

### Проверка

**1. Service Worker:**
```
DevTools → Application → Service Workers
Статус: activated and is running
```

**2. IndexedDB:**
```
DevTools → Application → Storage → IndexedDB → news-aggregator-offline
Таблицы: articles, feedSlices, articleDetails, pendingActions
```

**3. Офлайн-режим:**
```
DevTools → Network → Offline (чекбокс)
Перезагрузить страницу
```

### Решение

**Очистить Service Worker:**
```
DevTools → Application → Service Workers → Unregister
Перезагрузить страницу (Ctrl+Shift+R)
```

**Очистить IndexedDB:**
```
DevTools → Application → Storage → IndexedDB → news-aggregator-offline → Delete database
Перезагрузить страницу
```

**Проверить манифест:**
```
DevTools → Application → Manifest
Должен быть manifest.json с name, icons, start_url
```

**Проверить сборку:**
```bash
npm run build
# Проверить dist/sw.js существует
```

---

## Погода не загружается

### Симптомы
- Страница /weather показывает ошибку
- В консоли: `Failed to fetch weather data`

### Проверка

```bash
# Проверить API
curl http://localhost:5000/api/weather/locations
curl "http://localhost:5000/api/weather/week?locationId=1"

# Проверить Open-Meteo
curl "https://api.open-meteo.com/v1/forecast?latitude=55.75&longitude=37.62&daily=temperature_2m_max&timezone=Europe/Moscow"
```

### Решение

**1. Проверить города в БД:**
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM weather_locations WHERE is_active = true;"
# Должно быть > 0
```

**2. Сидирование городов:**
```bash
npx tsx scripts/seed-weather-locations.ts
```

**3. Запустить сбор погоды:**
```bash
curl -X POST http://localhost:5000/api/admin/weather/collect \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**4. Проверить лимиты Open-Meteo:**
Open-Meteo имеет лимит 10,000 запросов/день для бесплатного использования.

```bash
# Проверить логи
grep "Open-Meteo" logs/app.log
```

**5. Fallback на кэш:**
Если Open-Meteo недоступен, система использует данные из БД (последний успешный сбор).

---

## Общие команды диагностики

### Проверка здоровья системы

```bash
# Общее здоровье
curl http://localhost:5000/api/health

# Здоровье компонентов (требует auth)
curl http://localhost:5000/api/admin/monitoring/health \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Статистика кэша
curl http://localhost:5000/api/admin/monitoring/cache-stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Алерты
curl http://localhost:5000/api/admin/alerts \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Логи

```bash
# Последние 100 строк
tail -n 100 logs/app.log

# Ошибки
grep ERROR logs/app.log

# Конкретный компонент
grep "CollectNewsUseCase" logs/app.log
```

### База данных

```bash
# Подключение
psql $DATABASE_URL

# Размер таблиц
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Активные запросы
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;
```

### Redis

```bash
# Информация
redis-cli INFO

# Ключи по паттерну
redis-cli KEYS "news:*"

# Размер кэша
redis-cli DBSIZE

# Очистить кэш
redis-cli FLUSHDB
```

---

## Контакты поддержки

- **GitHub Issues:** https://github.com/Chucha-blog/blogpro/issues
- **Email:** rockbandbugs@gmail.com
- **Документация:** [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)

---

> См. также: [PERFORMANCE.md](./PERFORMANCE.md), [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md), [ARCHITECTURE.md](./ARCHITECTURE.md)
