# Слайды для Эпизода 9: "База данных и производительность"

> **Презентация:** 22-24 слайда для 25-30 минут эпизода

---

### Слайд 1: Заставка
```
NewsAggregator — Database & Performance
Эпизод 9: "База данных и производительность"

🗄️ PostgreSQL 17: GIN-индекс, tsvector, jsonb
⚡ Drizzle ORM: типобезопасные запросы
📦 Repository Pattern: фильтрация, архивирование
🔴 Redis кэш: теги, gzip, stale-while-revalidate
🔄 Жизненный цикл: INSERT → archive → delete
```

### Слайд 2: Почему Drizzle, а не Prisma/TypeORM
```
Prisma:
  ❌ Отдельный .prisma файл — не TypeScript
  ❌ Тяжёлый runtime (Prisma Client Engine)
  ❌ Сложные raw SQL запросы
  ✅ Хорошая документация

TypeORM:
  ❌ Декораторы — экспериментальный синтаксис
  ❌ Сложная конфигурация
  ❌ Медленные запросы при сложных join'ах

Drizzle:
  ✅ Схема — чистый TypeScript
  ✅ Лёгкий runtime (нет отдельного процесса)
  ✅ SQL-like синтаксис — понятно что происходит
  ✅ Полный контроль над запросами
  ✅ Отличная интеграция с pg Pool
  ✅ drizzle-kit для миграций
```

---

## Блок 1: Схема БД (слайды 3-6)

### Слайд 3: customType — tsvector
```typescript
// Drizzle не знает о tsvector — создаём сами
const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

// Использование в таблице
export const newsArticles = pgTable('news_articles', {
  // ...
  searchVector: tsvector('search_vector'), // GIN-индекс
  entities:     jsonb('entities'),         // NER данные
});

// TypeScript тип: string (сырой tsvector)
// В запросах используем sql`` для работы с ним

// Зачем customType:
// Drizzle генерирует правильный DDL: search_vector tsvector
// TypeScript знает тип поля
// Миграции работают корректно
```

### Слайд 4: 18 таблиц — карта
```
┌─────────────────────────────────────────────────────────┐
│                    Ядро новостей                        │
│  news_sources → news_articles → news_clusters           │
│                 collection_stats                        │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                    Пользователи                         │
│  user_tokens → user_channel_subscriptions               │
│             → user_bookmarks                            │
│             → push_subscriptions                        │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                    Реакции                              │
│  article_reactions  (лайки/дизлайки, dailyHash)         │
│  article_emotions   (эмодзи, UNIQUE article+hash)       │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│              Аналитика и безопасность                   │
│  page_events (dailyHash вместо IP)                      │
│  admin_audit_log, admin_tokens, api_keys (keyHash)      │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                    Погода                               │
│  weather_locations (51 город)                           │
│  weather_forecasts (7 дней × N городов)                 │
│  weather_hourly_forecasts (168 часов × N городов)       │
└─────────────────────────────────────────────────────────┘
```

### Слайд 5: Ключевые решения в схеме
```
url: text('url').notNull().unique()
  → UNIQUE constraint — дедупликация статей по URL
  → onConflictDoNothing при INSERT

onDelete: 'set null' (sourceId, clusterId)
  → При удалении источника статьи остаются
  → sourceId = NULL, данные не теряются

dailyHash: varchar('daily_hash', { length: 16 })
  → SHA256(IP + UserAgent + date)[:16]
  → Уникальные пользователи без хранения IP
  → GDPR-совместимость

keyHash: varchar('key_hash', { length: 64 }).unique()
  → Только SHA-256 хэш API-ключа
  → Сам ключ не хранится — нельзя украсть

entities: jsonb('entities')
  → { PER: [], ORG: [], LOC: [], FIRST: [] }
  → Гибкая структура — не нужна отдельная таблица
  → Запросы через jsonb_array_elements_text()
```

### Слайд 6: Connection Pool + Redis graceful degradation
```typescript
// db.ts — Pool с retry
export const pool = new Pool({
  max: dbConfig.max,   // из конфига (обычно 10-20)
  min: 2,              // всегда готовы 2 соединения
  idleTimeoutMillis: dbConfig.idleTimeoutMillis,
  connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
});

// Retry с экспоненциальной задержкой
async function checkDatabaseConnection(retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT version()');
      client.release();
      return true;
    } catch {
      await new Promise(r => setTimeout(r, delay));
      delay *= 2; // 1s → 2s → 4s
    }
  }
  return false;
}

// redis.ts — graceful degradation
// ECONNREFUSED → redisEnabled = false
// getRedisClient() → null
// Приложение работает с in-memory кэшем
```

---

## Блок 2: Полнотекстовый поиск (слайды 7-9)

### Слайд 7: GIN-индекс — как работает
```
Обычный B-tree индекс:
  Ищет точные значения или диапазоны
  "Путин" → нет (нужно LIKE '%Путин%' → full scan)

GIN (Generalized Inverted Index):
  Индекс слов → список документов
  "путин" → [article_id: 1, 5, 12, 47, ...]
  "байден" → [article_id: 1, 8, 23, ...]

  Запрос: "Путин Байден"
  → пересечение списков → [article_id: 1, ...]
  → O(log n) вместо O(n)

tsvector — нормализованный вектор слов:
  "Путин встретился с Байденом в Женеве"
  → 'байден':4B 'встретиться':2A 'женева':6B 'путин':1A

  Веса: A (заголовок) > B (описание)
  Стемминг: "встретился" → "встретиться"
```

### Слайд 8: Триггер tsvector_update
```sql
-- Автоматически обновляется при INSERT/UPDATE
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    -- Заголовок: вес A (самый важный)
    setweight(to_tsvector('russian', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    -- Описание: вес B
    setweight(to_tsvector('russian', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvector_update
BEFORE INSERT OR UPDATE ON news_articles
FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- GIN-индекс для быстрого поиска
CREATE INDEX idx_news_articles_search_vector
ON news_articles USING GIN(search_vector);
```

### Слайд 9: Поиск в коде
```typescript
// plainto_tsquery — безопасный парсинг ввода пользователя
// Не нужно экранировать спецсимволы
// "Путин & Байден" → plainto_tsquery → 'путин' & 'байден'

// @@ — оператор совпадения tsvector с tsquery
sql`${newsArticles.searchVector} @@ (
  plainto_tsquery('russian', ${query}) ||
  plainto_tsquery('english', ${query})
)`

// ts_rank — ранжирование по релевантности
// Учитывает веса A/B и частоту слов
.orderBy(sql`ts_rank(
  ${newsArticles.searchVector},
  plainto_tsquery('russian', ${query})
) DESC`)

// phraseto_tsquery — точная фраза
// "Дональд Трамп" → 'дональд' <-> 'трамп'
// Порядок слов важен, слова должны быть рядом
```

---

## Блок 3: Repository Pattern (слайды 10-14)

### Слайд 10: onConflictDoNothing — дедупликация
```typescript
async insert(article: NewArticleInput): Promise<NewsArticle | null> {
  const [row] = await db
    .insert(newsArticles)
    .values({ ...article })
    // UNIQUE(url) → при дубликате не бросаем ошибку
    .onConflictDoNothing({ target: newsArticles.url })
    .returning(); // возвращаем вставленную строку

  return row ? toNewsArticle(row) : null;
  // null → статья уже существует (дубликат)
}

// Зачем это важно:
// RSS-ленты часто содержат одни и те же статьи
// Без onConflictDoNothing → ошибка при каждом дубликате
// С ним → тихо игнорируем, продолжаем сбор
```

### Слайд 11: Параллельные запросы — данные + COUNT
```typescript
// Антипаттерн: два последовательных запроса
const rows = await db.select()...;
const [{ count }] = await db.select({ count: sql`COUNT(*)` })...;
// Время: T1 + T2

// Правильно: Promise.all — параллельно
const [rows, [{ count }]] = await Promise.all([
  db.select().from(newsArticles).where(where)
    .orderBy(desc(newsArticles.publishedAt))
    .limit(limit).offset(offset),
  db.select({ count: sql<number>`COUNT(*)` })
    .from(newsArticles).where(where),
]);
// Время: max(T1, T2) — экономим ~50% времени

return { articles: rows.map(toNewsArticle), total: Number(count) };
```

### Слайд 12: Динамическая фильтрация
```typescript
// Условия накапливаются динамически
const conditions = [eq(newsArticles.isArchived, false)];

// Несколько категорий: eq() или inArray()
if (cats.length === 1) {
  conditions.push(eq(newsArticles.category, cats[0]));
} else {
  conditions.push(inArray(newsArticles.category, cats)); // IN (...)
}

// Город через подзапрос
if (filters.city) {
  conditions.push(sql`${newsArticles.sourceId} IN (
    SELECT id FROM news_sources
    WHERE city = ${filters.city} AND is_active = true
  )`);
}

// Дата с учётом часового пояса
// tzOffsetMinutes: JS convention (UTC = local + offset)
// Tokyo UTC+9: offset = -540
// dayStartUtcForUserDate('2025-05-15', -540)
// → 2025-05-14T15:00:00Z (начало дня в Токио = 15:00 UTC)
```

### Слайд 13: jsonb_array_elements_text — поиск по NER
```
entities JSONB:
{
  "PER": ["Путин", "Байден"],
  "ORG": ["Газпром"],
  "LOC": ["Москва", "Женева"],
  "FIRST": ["Путин"]   ← первая сущность в заголовке
}

Запрос: найти статьи где FIRST содержит "Путин"

SQL:
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(
      COALESCE(entities->'FIRST', '[]'::jsonb)
    ) AS e
    WHERE e ILIKE 'Путин'
  )

Оптимизации:
  1. Фильтр коротких терминов (< 3 символов)
     Исключение: аббревиатуры в верхнем регистре (США, ВСУ)
  2. Разбивка многословных сущностей:
     "Дональд Трамп" → ["Дональд", "Трамп"]
  3. Сортировка по числу совпадений DESC
```

### Слайд 14: Жизненный цикл статьи
```
День 0:   INSERT
          isArchived = false
          Видна в ленте

День 14:  archiveOlderThan(now - 14d)
          isArchived = true
          Скрыта из ленты
          Данные сохранены

День 28:  deleteOlderThan(now - 28d)
          DELETE WHERE isArchived = true
          Физическое удаление

Зачем двухэтапное удаление?
  → Возможность восстановить данные 14 дней
  → Мягкое удаление не ломает кэш мгновенно
  → Статистика и аналитика остаются корректными

node-cron расписание:
  '0 2 * * *' → каждую ночь в 2:00
  archiveOlderThan(now - 14 дней)
  deleteOlderThan(now - 28 дней)
```

---

## Блок 4: Двухуровневый кэш (слайды 15-20)

### Слайд 15: Архитектура кэша
```
HTTP запрос → createCacheMiddleware()
        │
        ▼
generateCacheKey(req, options)
  prefix:path:queryParams[:headers]
  Пример: "news:list:/api/news:page=1&region=russia"
        │
        ▼
queryCacheService.get(key)
        │
        ├─ Redis.get(key) → HIT?
        │    ├─ 'gz:...' → gunzip → JSON.parse
        │    └─ JSON.parse
        │    → res.json(data), X-Cache: HIT
        │
        ├─ memoryCache.get(key) → HIT?
        │    expires > Date.now()?
        │    → res.json(data), X-Cache: HIT
        │
        └─ MISS → next()
             override res.json
             → setImmediate: set(key, data, ttl, tags)
             → res.json(data), X-Cache: MISS
```

### Слайд 16: Теги — групповая инвалидация
```
Сохранение с тегами:
  set('news:list:/api/news:page=1', data, 300, ['news'])
  set('news:list:/api/news:page=2', data, 300, ['news'])
  set('news:search:/api/news/search:q=путин', data, 120, ['news', 'search'])

Redis структура:
  cache:tag:news → SET { 'news:list:...page=1',
                         'news:list:...page=2',
                         'news:search:...q=путин' }

Инвалидация при новых статьях:
  eventBus.emit('articles.collected')
  → invalidateByTags(['news'])
  → sMembers('cache:tag:news') → все ключи
  → pipeline.del(все ключи)
  → pipeline.del('cache:tag:news')
  → exec() — атомарно

Результат: все страницы ленты инвалидированы одним вызовом
```

### Слайд 17: gzip сжатие
```typescript
private readonly compressionThreshold = 1024; // 1KB

async set(key, data, ttl, tags) {
  const serialized = JSON.stringify({ data, timestamp, tags });

  let finalData: string;
  if (serialized.length > this.compressionThreshold) {
    // Большой ответ → сжимаем
    const compressed = await gzipAsync(Buffer.from(serialized, 'utf8'));
    finalData = 'gz:' + compressed.toString('base64');
    // Экономия: обычно 60-80% для JSON
  } else {
    finalData = serialized;
  }

  await redisClient.setEx(key, ttl, finalData);
}

async get(key) {
  const cached = await redisClient.get(key);
  if (cached) {
    const raw = cached.startsWith('gz:')
      ? (await gunzipAsync(Buffer.from(cached.slice(3), 'base64'))).toString('utf8')
      : cached;
    return JSON.parse(raw);
  }
}

// Пример: лента 50 статей
// JSON: ~150KB → gzip: ~25KB → экономия 83%
// Redis memory: значительно меньше
```

### Слайд 18: stale-while-revalidate
```
Проблема без stale-while-revalidate:
  TTL истёк → cache miss → запрос к БД → медленно
  Все пользователи одновременно видят задержку

С stale-while-revalidate:
  TTL = 300 сек (5 мин)
  staleWhileRevalidate = 60 сек

  0-60 сек:   FRESH → отдаём из кэша
  60-300 сек: STALE → отдаём из кэша (быстро!)
              + setImmediate: удаляем ключ
              → следующий запрос получит свежие данные
  300+ сек:   MISS → запрос к БД

Заголовки:
  X-Cache: HIT
  X-Cache-Status: STALE  ← данные устарели, но отданы быстро

Результат:
  Пользователь всегда получает быстрый ответ
  Данные обновляются незаметно в фоне
```

### Слайд 19: in-memory fallback
```typescript
private memoryCache = new Map<string, {
  data: any;
  expires: number;
  tags: string[];
}>();

private readonly maxMemoryCacheSize = 1000;

private setMemoryCache(key, data, ttlSeconds, tags) {
  // LRU-подобное поведение: удаляем самую старую запись
  if (this.memoryCache.size >= this.maxMemoryCacheSize) {
    const oldestKey = this.memoryCache.keys().next().value;
    if (oldestKey) this.memoryCache.delete(oldestKey);
  }

  this.memoryCache.set(key, {
    data,
    expires: Date.now() + (ttlSeconds * 1000),
    tags,
  });
}

// Когда используется:
// Redis недоступен (ECONNREFUSED → redisEnabled = false)
// → getRedisClient() → null
// → fallback на memoryCache
// Приложение продолжает работать!

// Ограничения in-memory:
// Не shared между процессами (PM2 cluster)
// Теряется при рестарте
// Поэтому Redis — основной, memory — fallback
```

### Слайд 20: Готовые middleware
```typescript
export const cacheMiddlewares = {
  newsList: {
    ttl: 300,                    // 5 минут
    keyPrefix: 'news:list',
    tags: ['news'],
    varyBy: ['x-browser-id'],   // разный кэш для разных браузеров
    staleWhileRevalidate: 60,   // 1 минута stale
  },
  newsSearch: {
    ttl: 120,                   // 2 минуты
    tags: ['news', 'search'],
    skipCache: (req) =>         // не кэшируем короткие запросы
      !req.query.q || String(req.query.q).length < 3,
  },
  sources: {
    ttl: 3600,                  // 1 час (меняются редко)
    tags: ['sources'],
  },
  popular: {
    ttl: 300,
    tags: ['news', 'popular'],
  },
  stats: {
    ttl: 600,                   // 10 минут
    tags: ['admin', 'stats'],
  },
};

// Использование в роутере:
router.get('/news', cacheMiddlewares.newsList, newsController.list);
```

---

## Заключение (слайды 21-23)

### Слайд 21: Архитектура целиком
```
schema.ts (shared)
  18 таблиц, customType tsvector, jsonb entities
  UNIQUE url, onDelete: 'set null', dailyHash

db.ts
  Pool (min: 2), retry с экспоненциальной задержкой

redis.ts
  Singleton, ECONNREFUSED → graceful degradation

NewsArticleRepository.ts
  onConflictDoNothing (дедупликация)
  Promise.all (данные + COUNT параллельно)
  plainto_tsquery / phraseto_tsquery (поиск)
  jsonb_array_elements_text (NER поиск)
  archiveOlderThan / deleteOlderThan (жизненный цикл)

QueryCacheService.ts
  Redis → in-memory fallback
  Теги → групповая инвалидация через pipeline
  gzip сжатие > 1KB
  stale-while-revalidate
  X-Cache / X-Cache-Status заголовки
```

### Слайд 22: Ключевые решения
```
✅ customType для tsvector
   → Drizzle генерирует правильный DDL
   → TypeScript знает тип поля

✅ onConflictDoNothing вместо проверки EXISTS
   → Атомарная операция на уровне БД
   → Нет race condition при параллельном сборе

✅ Promise.all для данных + COUNT
   → Экономия ~50% времени запроса

✅ dailyHash вместо IP
   → Уникальные пользователи без PII
   → GDPR-совместимость

✅ Двухэтапное архивирование
   → 14 дней на восстановление данных

✅ Redis pipeline для тегов
   → Атомарное обновление тегов и ключей
```

### Слайд 23: Анонс Эпизода 10
```
🎬 Эпизод 10: "Deployment и DevOps"

🐳 Docker Compose — контейнеризация всего стека
🌐 Nginx — reverse proxy, SSL termination
⚙️  PM2 — управление процессами, cluster mode
💾 Бэкапы GFS — daily/weekly/monthly ротация
🔧 Drizzle Kit — миграции в production

Подписывайтесь! 👍
```

---

## 🎨 Дизайн-система

- **PostgreSQL:** `#336791` (синий PostgreSQL)
- **Drizzle ORM:** `#c5f74f` (лаймовый, цвет Drizzle)
- **Redis:** `#dc382d` (красный Redis)
- **GIN-индекс / поиск:** `#f59e0b` (янтарный)
- **Cache HIT:** `#22c55e` (зелёный)
- **Cache MISS:** `#6b7280` (серый)
- **Archive:** `#8b5cf6` (фиолетовый)

---

*Слайды основаны на реальном production-коде проекта.*
