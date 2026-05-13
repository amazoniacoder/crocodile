# Сценарии демонстрации для Эпизода 9: "База данных и производительность"

---

## 🎬 Демо 1: Drizzle схема — типы в VS Code

### Сценарий
1. Открыть `shared/types/schema.ts`
2. Навести на `newsArticles` → показать TypeScript тип
3. Показать `customType` для tsvector — объяснить зачем
4. Показать `jsonb('entities')` — структура NER данных
5. Показать `onDelete: 'set null'` — осознанное решение
6. Открыть `NewsArticleRepository.ts` → показать `$inferSelect`

### Что показать в VS Code
```typescript
// Навести на newsArticles.$inferSelect
// TypeScript покажет полный тип строки таблицы

// Навести на toNewsArticle(row)
// Показать маппинг snake_case → camelCase
```

---

## 🎬 Демо 2: Полнотекстовый поиск

### Сценарий
```bash
# Поиск на русском
curl -s "http://localhost:5000/api/news/search?q=Путин" | jq '{
  total: .total,
  first: .articles[0].title
}'

# Поиск на английском
curl -s "http://localhost:5000/api/news/search?q=economy" | jq '.articles | length'

# Поиск с фильтром региона
curl -s "http://localhost:5000/api/news/search?q=технологии&region=russia" | jq '.total'

# Показать что поиск работает через GIN-индекс (быстро)
time curl -s "http://localhost:5000/api/news/search?q=Байден" > /dev/null
```

### Показать в PostgreSQL (если есть доступ)
```sql
-- Посмотреть search_vector для статьи
SELECT title, search_vector
FROM news_articles
WHERE title ILIKE '%Путин%'
LIMIT 1;

-- Проверить что GIN-индекс используется
EXPLAIN ANALYZE
SELECT id, title
FROM news_articles
WHERE search_vector @@ plainto_tsquery('russian', 'Путин Байден');
-- → Bitmap Index Scan on idx_news_articles_search_vector
```

---

## 🎬 Демо 3: Кэш — заголовки X-Cache

### Сценарий
```bash
# Первый запрос — MISS
curl -s -I "http://localhost:5000/api/news?page=1" | grep -i "x-cache"
# X-Cache: MISS

# Второй запрос — HIT
curl -s -I "http://localhost:5000/api/news?page=1" | grep -i "x-cache"
# X-Cache: HIT
# X-Cache-Status: FRESH

# Разные параметры — разные ключи кэша
curl -s -I "http://localhost:5000/api/news?page=2" | grep -i "x-cache"
# X-Cache: MISS (другой ключ)

# Инвалидация кэша
curl -X POST http://localhost:5000/api/admin/cache/clear \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# После инвалидации — снова MISS
curl -s -I "http://localhost:5000/api/news?page=1" | grep -i "x-cache"
# X-Cache: MISS
```

---

## 🎬 Демо 4: Статистика кэша

### Сценарий
```bash
# Статистика кэша
curl -s http://localhost:5000/api/admin/cache/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Ожидаемый ответ:
# {
#   "redisAvailable": true,
#   "memoryCacheSize": 47,
#   "stats": {
#     "hits": 1247,
#     "misses": 89,
#     "sets": 89,
#     "errors": 0,
#     "hitRate": 0.93,
#     "totalRequests": 1336
#   }
# }

# Сгенерировать нагрузку для демонстрации hit rate
for i in {1..10}; do
  curl -s "http://localhost:5000/api/news?page=1" > /dev/null
done

# Проверить hit rate после нагрузки
curl -s http://localhost:5000/api/admin/cache/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.stats.hitRate'
# → 0.93 (93% запросов из кэша)
```

---

## 🎬 Демо 5: Архивирование статей

### Сценарий
```bash
# Запустить архивирование вручную
curl -X POST http://localhost:5000/api/admin/articles/archive \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Ожидаемый ответ:
# {
#   "archived": 142,
#   "deleted": 0,
#   "message": "Archived 142 articles older than 14 days"
# }

# Проверить количество архивированных статей
curl -s "http://localhost:5000/api/admin/stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{
    total: .articles.total,
    archived: .articles.archived,
    active: .articles.active
  }'
```

---

## 🎬 Демо 6: Connection Pool и Redis

### Сценарий
```bash
# Проверить подключение к БД
curl -s http://localhost:5000/api/health | jq '.components.database'
# { "status": "healthy", "responseTime": 8, "details": { "connectionCount": 3 } }

# Проверить Redis
curl -s http://localhost:5000/api/health | jq '.components.redis'
# { "status": "healthy", "responseTime": 2 }

# Показать что приложение работает без Redis
# (остановить Redis, проверить что кэш работает через in-memory)
```

### Показать в коде
```typescript
// redis.ts — graceful degradation
// При ECONNREFUSED:
// redisEnabled = false
// getRedisClient() → null
// QueryCacheService.get() → только memoryCache
// Приложение продолжает работать!
```

---

## ⚙️ Команды для подготовки

```bash
# Проверить что поиск работает
curl -s "http://localhost:5000/api/news/search?q=тест" | jq '.total'

# Проверить кэш заголовки
curl -s -I "http://localhost:5000/api/news" | grep -i "x-cache"

# Проверить статистику кэша
curl -s http://localhost:5000/api/admin/cache/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.stats'

# Проверить health check
curl -s http://localhost:5000/api/health | jq '{
  db: .components.database.status,
  redis: .components.redis.status
}'
```
