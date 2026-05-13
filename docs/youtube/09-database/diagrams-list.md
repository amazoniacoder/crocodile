# Диаграммы для Эпизода 9: "База данных и производительность"

---

## 📊 Диаграмма 1: Схема БД — связи таблиц

```
news_sources (1)
    │
    ├──< news_articles (N)          url UNIQUE, search_vector GIN
    │       │
    │       ├──< article_reactions  dailyHash (анонимность)
    │       ├──< article_emotions   UNIQUE(article_id, daily_hash)
    │       ├──< page_events        articleId (nullable)
    │       └──< user_bookmarks
    │
    ├──< collection_stats (N)
    └──< user_channel_subscriptions

news_clusters (1)
    └──< news_articles (N)          clusterId (nullable)

user_tokens (1)
    ├──< user_channel_subscriptions
    ├──< user_bookmarks
    ├──< push_subscriptions         tokenId (nullable)
    └──< admin_channel_access

weather_locations (1)
    ├──< weather_forecasts (N)      7 дней × N городов
    └──< weather_hourly_forecasts   168 часов × N городов

Отдельные таблицы (без FK):
    source_config    — key-value настройки
    hot_entities     — топ NER за 24ч
    api_keys         — keyHash (SHA-256)
    admin_audit_log  — UUID PK
    admin_tokens     — токены администраторов
    telegram_subscriptions
```

---

## 📊 Диаграмма 2: Drizzle ORM — от схемы до запроса

```
shared/types/schema.ts
  pgTable('news_articles', { ... })
        │
        ▼
TypeScript типы (автоматически):
  typeof newsArticles.$inferSelect → NewsArticle
  typeof newsArticles.$inferInsert → NewArticleInput
        │
        ▼
Drizzle Query Builder:
  db.select().from(newsArticles)
    .where(and(
      eq(newsArticles.isArchived, false),
      eq(newsArticles.region, 'russia')
    ))
    .orderBy(desc(newsArticles.publishedAt))
    .limit(20)
        │
        ▼
Генерируемый SQL:
  SELECT * FROM news_articles
  WHERE is_archived = false
    AND region = 'russia'
  ORDER BY published_at DESC
  LIMIT 20
        │
        ▼
pg Pool → PostgreSQL 17
        │
        ▼
rows → toNewsArticle(row) → NewsArticle[]
  (маппинг snake_case → camelCase)
```

---

## 📊 Диаграмма 3: GIN-индекс — как работает поиск

```
Статья вставлена:
  title: "Путин встретился с Байденом в Женеве"
        │
        ▼
Триггер tsvector_update:
  to_tsvector('russian', title) → 'байден':4A 'встретиться':2A 'женева':6A 'путин':1A
  to_tsvector('english', title) → 'bayden':4A 'met':2A 'geneva':6A 'putin':1A
  setweight(..., 'A') → заголовок важнее описания
        │
        ▼
GIN-индекс обновляется:
  'путин'       → [article_id: 1, 5, 12, 47, ...]
  'байден'      → [article_id: 1, 8, 23, ...]
  'встретиться' → [article_id: 1, 3, 19, ...]
  'женева'      → [article_id: 1, 7, ...]

Поисковый запрос: "Путин Байден"
  plainto_tsquery('russian', 'Путин Байден')
  → 'путин' & 'байден'
        │
        ▼
GIN lookup:
  'путин' → {1, 5, 12, 47}
  'байден' → {1, 8, 23}
  пересечение → {1}
        │
        ▼
ts_rank(search_vector, tsquery) → 0.87
  → сортировка по релевантности
```

---

## 📊 Диаграмма 4: Жизненный цикл статьи

```
RSS источник
    │
    ▼
RssParser.fetch()
    │
    ▼
newsArticleRepository.insert()
  INSERT INTO news_articles (url, ...)
  ON CONFLICT (url) DO NOTHING  ← дедупликация
    │
    ├─ row → toNewsArticle() → статья в ленте
    └─ null → дубликат, пропускаем

День 0-14: isArchived = false
  → видна в ленте
  → участвует в поиске
  → кэшируется

День 14: node-cron '0 2 * * *'
  archiveOlderThan(now - 14d)
  UPDATE news_articles SET is_archived = true
  WHERE published_at < now-14d AND is_archived = false
  → скрыта из ленты
  → кэш инвалидируется

День 28: node-cron '0 2 * * *'
  deleteOlderThan(now - 28d)
  DELETE FROM news_articles
  WHERE published_at < now-28d AND is_archived = true
  → физическое удаление
  → освобождение места в БД

Зачем 14 дней между архивом и удалением?
  → Возможность восстановить данные
  → Мягкое удаление не ломает кэш мгновенно
```

---

## 📊 Диаграмма 5: Двухуровневый кэш — поток

```
HTTP GET /api/news?page=1&region=russia
        │
        ▼
createCacheMiddleware({ ttl: 300, tags: ['news'] })
        │
        ▼
generateCacheKey(req):
  "news:list:/api/news:page=1&region=russia"
        │
        ▼
queryCacheService.get(key)
        │
        ├─ Redis.get(key) → данные?
        │    ├─ 'gz:...' → gunzip → JSON.parse → { data, timestamp, tags }
        │    └─ JSON.parse → { data, timestamp, tags }
        │
        │    staleWhileRevalidate = 60?
        │    age > 60 сек? → X-Cache-Status: STALE
        │                    setImmediate: del(key)
        │    иначе         → X-Cache-Status: FRESH
        │
        │    → res.json(data), X-Cache: HIT ✅
        │
        ├─ memoryCache.get(key) → expires > now?
        │    → res.json(data), X-Cache: HIT ✅
        │
        └─ MISS → next()
             override res.json(data)
             setImmediate:
               serialized = JSON.stringify({ data, timestamp, tags })
               > 1KB? → gzip → 'gz:' + base64
               Redis.setEx(key, 300, finalData)
               pipeline: sAdd('cache:tag:news', key)
               memoryCache.set(key, { data, expires, tags })
             → res.json(data), X-Cache: MISS
```

---

## 📊 Диаграмма 6: Тегированная инвалидация

```
Кэш содержит:
  "news:list:/api/news:page=1"  → tags: ['news']
  "news:list:/api/news:page=2"  → tags: ['news']
  "news:search:q=путин"         → tags: ['news', 'search']
  "news:sources:/api/sources"   → tags: ['sources']

Redis:
  cache:tag:news    → SET { key1, key2, key3 }
  cache:tag:search  → SET { key3 }
  cache:tag:sources → SET { key4 }

EventBus: 'articles.collected'
  → invalidateByTags(['news'])
        │
        ▼
  sMembers('cache:tag:news') → [key1, key2, key3]
        │
        ▼
  pipeline:
    del(key1)
    del(key2)
    del(key3)
    del('cache:tag:news')
  pipeline.exec() — атомарно
        │
        ▼
  memoryCache: удаляем записи с тегом 'news'
        │
        ▼
  Результат: 3 ключа инвалидированы
  'news:sources' — НЕ тронут (другой тег)

EventBus: 'source.updated'
  → invalidateByTags(['sources', 'news'])
  → инвалидирует ВСЁ
```

---

## 📊 Диаграмма 7: findByEntities — jsonb поиск

```
Запрос: найти статьи похожие на статью про "Путина"
  terms = ["Путин"]
  minMatches = 1
  since = now - 48ч

Шаг 1: фильтрация терминов
  "Путин" → length=5 >= 3 → OK
  "ЦБ"   → length=2 < 3, но ЦБ === ЦБ.toUpperCase() → OK (аббревиатура)
  "и"    → length=1 < 3, не аббревиатура → отфильтровать

Шаг 2: разбивка многословных
  "Дональд Трамп" → ["Дональд", "Трамп"]
  expandedTerms = ["Путин", "Дональд", "Трамп"]

Шаг 3: matchExpr для каждого термина
  CASE WHEN EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(
      COALESCE(entities->'FIRST', '[]'::jsonb)
    ) AS e WHERE e ILIKE 'Путин'
  ) THEN 1 ELSE 0 END

  + аналогично для "Дональд", "Трамп"
  → matchExpr = sum(0 или 1 для каждого термина)

Шаг 4: WHERE matchExpr >= minMatches(1)
  + is_archived = false
  + id != excludeId
  + published_at >= since

Шаг 5: ORDER BY matchExpr DESC, published_at DESC
  → статьи с наибольшим числом совпадений первыми
```

---

*Диаграммы основаны на реальной реализации проекта.*
