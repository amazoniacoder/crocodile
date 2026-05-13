# Эпизод 9: "База данных и производительность"

> **Длительность:** 25-30 минут
> **Цель:** Показать реальную работу с PostgreSQL + Drizzle ORM + двухуровневый кэш
> **Аудитория:** Backend разработчики, fullstack

---

## 🎯 Цели эпизода

- Разобрать схему БД — 18 таблиц, tsvector, jsonb, customType в Drizzle
- Показать GIN-индекс и полнотекстовый поиск — searchVector, plainto_tsquery
- Объяснить Repository Pattern — NewsArticleRepository, типобезопасные запросы
- Разобрать двухуровневый кэш — Redis → in-memory fallback, теги, сжатие
- Показать архивирование — жизненный цикл статей, archiveOlderThan / deleteOlderThan

---

## 📝 Сценарий эпизода

### 🎬 Интро (2 минуты)

**[Показать schema.ts в VS Code]**

**Ведущий:**
> Привет! Девятый эпизод — база данных и производительность. 18 таблиц, PostgreSQL 17, Drizzle ORM. Смотрите: здесь tsvector для полнотекстового поиска, jsonb для NER-сущностей, customType для нестандартных типов. Всё типобезопасно — TypeScript знает структуру каждой таблицы.

**[Показать структуру эпизода]**

> Разберём четыре слоя:
> - Схема БД — таблицы, типы, связи
> - Полнотекстовый поиск — GIN-индекс, tsvector, триггер
> - Repository Pattern — Drizzle запросы, фильтрация, архивирование
> - Двухуровневый кэш — QueryCacheService, теги, сжатие, stale-while-revalidate

---

### 🗄️ Блок 1: Схема базы данных (6 минут)

#### Подблок 1.1: Drizzle ORM — типобезопасная схема

**[Открыть shared/types/schema.ts]**

**Ведущий:**
> Drizzle — не ORM в классическом смысле. Это type-safe query builder. Схема — это TypeScript код, который одновременно является источником правды для миграций и типов.

```typescript
// shared/types/schema.ts
import { pgTable, serial, varchar, text, integer, timestamp,
         boolean, customType, jsonb, decimal, date } from 'drizzle-orm/pg-core';

// customType — для типов которых нет в Drizzle из коробки
const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

export const newsArticles = pgTable('news_articles', {
  id:          serial('id').primaryKey(),
  sourceId:    integer('source_id').references(() => newsSources.id, { onDelete: 'set null' }),
  title:       text('title').notNull(),
  description: text('description'),
  url:         text('url').notNull().unique(),        // UNIQUE — дедупликация по URL
  publishedAt: timestamp('published_at').notNull(),
  region:      varchar('region', { length: 20 }).notNull().default('russia'),
  category:    varchar('category', { length: 50 }).notNull().default('other'),
  clusterId:   integer('cluster_id').references(() => newsClusters.id, { onDelete: 'set null' }),
  isArchived:  boolean('is_archived').default(false),
  searchVector: tsvector('search_vector'),            // GIN-индекс для полнотекстового поиска
  entities:    jsonb('entities'),                     // NER: { PER: [], ORG: [], LOC: [], FIRST: [] }
  likesCount:  integer('likes_count').default(0).notNull(),
  sourceType:  varchar('source_type', { length: 20 }).notNull().default('rss'),
  videoId:     varchar('video_id', { length: 20 }),   // YouTube
  messageId:   integer('message_id'),                 // Telegram
});
```

**Ведущий:**
> `onDelete: 'set null'` — при удалении источника статьи остаются, sourceId становится NULL. Это осознанное решение: исторические данные важнее ссылочной целостности.

#### Подблок 1.2: 18 таблиц — обзор

```
Ядро новостей:
  news_sources        — белый список RSS-источников
  news_articles       — статьи (UNIQUE url, GIN search_vector, jsonb entities)
  news_clusters       — группы похожих статей
  collection_stats    — статистика каждого цикла сбора

Пользователи:
  user_tokens         — токены личных кабинетов
  user_channel_subscriptions — подписки на каналы
  user_bookmarks      — закладки

Реакции:
  article_reactions   — лайки/дизлайки (dailyHash — анонимность)
  article_emotions    — эмодзи-реакции (UNIQUE article_id + daily_hash)

Аналитика и безопасность:
  page_events         — анонимная аналитика (dailyHash вместо IP)
  admin_audit_log     — аудит действий администраторов
  admin_tokens        — токены администраторов
  api_keys            — публичный API (keyHash — SHA-256)

Инфраструктура:
  source_config       — настройки планировщика
  hot_entities        — топ NER-сущностей за 24ч
  push_subscriptions  — Web Push подписки

Погода:
  weather_locations   — 51 город
  weather_forecasts   — дневные прогнозы (7 дней × N городов)
  weather_hourly_forecasts — почасовые (168 часов × N городов)
```

#### Подблок 1.3: Интересные типы

```typescript
// jsonb — NER сущности, гибкая структура
entities: jsonb('entities')
// { PER: ["Путин", "Байден"], ORG: ["Газпром"], LOC: ["Москва"], FIRST: ["Путин"] }
// Запрос: entities->'FIRST' → jsonb_array_elements_text()

// decimal — точные числа для погоды
tempMin: decimal('temp_min', { precision: 4, scale: 1 })  // -99.9 до 999.9
kpIndex: decimal('kp_index', { precision: 3, scale: 1 })  // 0.0 до 9.0

// dailyHash — анонимность без хранения IP
// SHA256(IP + UserAgent + date)[:16]
// Позволяет считать уникальных пользователей без хранения PII
dailyHash: varchar('daily_hash', { length: 16 })

// keyHash — безопасное хранение API-ключей
// Хранится только SHA-256 хэш, не сам ключ
keyHash: varchar('key_hash', { length: 64 }).notNull().unique()
```

---

### 🔍 Блок 2: Полнотекстовый поиск (5 минут)

#### Подблок 2.1: GIN-индекс и tsvector

**Ведущий:**
> PostgreSQL имеет встроенный полнотекстовый поиск. GIN-индекс (Generalized Inverted Index) — как индекс в конце книги: слово → список статей где оно встречается.

```sql
-- Миграция: создание GIN-индекса
CREATE INDEX idx_news_articles_search_vector
ON news_articles USING GIN(search_vector);

-- Триггер: автоматическое обновление search_vector
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('russian', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('russian', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvector_update
BEFORE INSERT OR UPDATE ON news_articles
FOR EACH ROW EXECUTE FUNCTION update_search_vector();
```

**Ведущий:**
> `setweight('A')` — заголовок важнее описания. При ранжировании результатов совпадение в заголовке даёт больший вес. Два языка — русский и английский — потому что в ленте есть и те и другие источники.

#### Подблок 2.2: Поиск в Repository

**[Открыть server/infrastructure/persistence/NewsArticleRepository.ts]**

```typescript
// Полнотекстовый поиск — plainto_tsquery
async search(query: string, limit: number): Promise<NewsArticle[]> {
  const rows = await db
    .select()
    .from(newsArticles)
    .where(and(
      eq(newsArticles.isArchived, false),
      // @@ — оператор совпадения tsvector с tsquery
      // plainto_tsquery — безопасный парсинг пользовательского ввода
      // || — OR: ищем в русском ИЛИ английском
      sql`${newsArticles.searchVector} @@ (
        plainto_tsquery('russian', ${query}) ||
        plainto_tsquery('english', ${query})
      )`,
    ))
    // ts_rank — ранжирование по релевантности
    .orderBy(sql`ts_rank(
      ${newsArticles.searchVector},
      plainto_tsquery('russian', ${query})
    ) DESC`)
    .limit(limit);
  return rows.map(toNewsArticle);
}

// findRelatedByQuery — phrase или plain режим
async findRelatedByQuery(query: string, limit: number, opts = {}) {
  const tsq = opts.mode === 'phrase'
    ? sql`phraseto_tsquery('russian', ${query}) || phraseto_tsquery('english', ${query})`
    : sql`plainto_tsquery('russian', ${query}) || plainto_tsquery('english', ${query})`;

  // phraseto_tsquery — ищет точную фразу, порядок слов важен
  // plainto_tsquery — ищет все слова в любом порядке
}
```

---

### 📦 Блок 3: Repository Pattern (6 минут)

#### Подблок 3.1: Типобезопасные запросы Drizzle

```typescript
// Вставка с дедупликацией по URL
async insert(article: NewArticleInput): Promise<NewsArticle | null> {
  const [row] = await db
    .insert(newsArticles)
    .values({ ...article })
    .onConflictDoNothing({ target: newsArticles.url }) // UNIQUE url → игнорируем дубликат
    .returning();
  return row ? toNewsArticle(row) : null;
}

// Параллельные запросы — данные + COUNT одним вызовом
async findMany(filters, page, limit) {
  const where = and(...conditions);
  const offset = (page - 1) * limit;

  const [rows, [{ count }]] = await Promise.all([
    db.select().from(newsArticles).where(where)
      .orderBy(desc(newsArticles.publishedAt))
      .limit(limit).offset(offset),
    db.select({ count: sql<number>`COUNT(*)` })
      .from(newsArticles).where(where),
  ]);

  return { articles: rows.map(toNewsArticle), total: Number(count) };
}
```

#### Подблок 3.2: Сложная фильтрация

```typescript
// Динамическое построение условий
const conditions = [eq(newsArticles.isArchived, filters.isArchived ?? false)];

// Несколько категорий одновременно
if (filters.category && filters.category !== 'all') {
  const cats = Array.isArray(filters.category) ? filters.category : [filters.category];
  if (cats.length === 1) {
    conditions.push(eq(newsArticles.category, cats[0]));
  } else {
    conditions.push(inArray(newsArticles.category, cats)); // IN (...)
  }
}

// Фильтр по городу — через подзапрос к news_sources
if (filters.city) {
  conditions.push(sql`${newsArticles.sourceId} IN (
    SELECT id FROM news_sources WHERE city = ${filters.city} AND is_active = true
  )`);
}

// Фильтр по дате с учётом часового пояса пользователя
if (filters.dateFrom) {
  const start = dayStartUtcForUserDate(filters.dateFrom, filters.tzOffsetMinutes ?? 0);
  if (start) conditions.push(gte(newsArticles.publishedAt, start));
}
// tzOffsetMinutes: JS convention — UTC = local + offset
// Tokyo (UTC+9): offset = -540
```

#### Подблок 3.3: Поиск по NER-сущностям через jsonb

```typescript
// findByEntities — поиск статей по FIRST-сущности
async findByEntities(opts: { terms: string[], minMatches: number, since: Date, ... }) {
  // Фильтр коротких терминов — дают шумные совпадения
  const filteredTerms = terms.filter(t => t.length >= 3 || t === t.toUpperCase());
  // Аббревиатуры (США, ВСУ) пропускаем — они уникальны

  // Разбиваем многословные сущности на токены
  // «Дональд Трамп» → ['Дональд', 'Трамп']
  const expandedTerms = [...new Set(
    filteredTerms.flatMap(t => t.split(' ').filter(w => w.length >= 3))
  )];

  // jsonb_array_elements_text — разворачивает JSON-массив в строки
  // ILIKE — регистронезависимое совпадение
  const matchExpr = expandedTerms
    .map(t => sql`(CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(
        COALESCE(${newsArticles.entities}->'FIRST', '[]'::jsonb)
      ) AS e WHERE e ILIKE ${t}
    ) THEN 1 ELSE 0 END)`)
    .reduce((acc, c) => sql`${acc} + ${c}`);

  // Сортировка: сначала статьи с наибольшим числом совпадений
  .orderBy(sql`(${matchExpr}) DESC`, desc(newsArticles.publishedAt))
}
```

#### Подблок 3.4: Архивирование — жизненный цикл статей

```typescript
// Жизненный цикл статьи:
// День 0:  INSERT → isArchived = false
// День 14: archiveOlderThan() → isArchived = true
// День 28: deleteOlderThan() → физическое удаление

async archiveOlderThan(date: Date): Promise<number> {
  const result = await db
    .update(newsArticles)
    .set({ isArchived: true })
    .where(sql`${newsArticles.publishedAt} < ${date}
               AND ${newsArticles.isArchived} = false`);
  return result.rowCount ?? 0;
}

async deleteOlderThan(date: Date): Promise<number> {
  const result = await db
    .delete(newsArticles)
    .where(sql`${newsArticles.publishedAt} < ${date}
               AND ${newsArticles.isArchived} = true`);
  return result.rowCount ?? 0;
}

// Запускается через node-cron:
// archiveOlderThan(now - 14 дней) — каждую ночь
// deleteOlderThan(now - 28 дней) — каждую ночь
// Двухэтапное удаление: сначала архив, потом физическое удаление
// Даёт возможность восстановить данные в течение 14 дней
```

---

### ⚡ Блок 4: Двухуровневый кэш (6 минут)

#### Подблок 4.1: Архитектура QueryCacheService

**[Открыть server/infrastructure/monitoring/QueryCacheService.ts]**

```typescript
// server/infrastructure/monitoring/QueryCacheService.ts

export class QueryCacheService {
  // Уровень 1: Redis (персистентный, shared между процессами)
  // Уровень 2: in-memory Map (быстрый, локальный, max 1000 записей)

  private memoryCache = new Map<string, {
    data: any;
    expires: number;
    tags: string[];
  }>();

  private readonly maxMemoryCacheSize = 1000;
  private readonly compressionThreshold = 1024; // 1KB → сжимаем

  async get(key: string) {
    // Сначала Redis
    const redisClient = await getRedisClient();
    if (redisClient) {
      const cached = await redisClient.get(key);
      if (cached) {
        // Распаковываем если сжато
        const raw = cached.startsWith('gz:')
          ? (await gunzipAsync(Buffer.from(cached.slice(3), 'base64'))).toString('utf8')
          : cached;
        return JSON.parse(raw);
      }
    }

    // Fallback: in-memory
    const memoryCached = this.memoryCache.get(key);
    if (memoryCached && memoryCached.expires > Date.now()) {
      return { data: memoryCached.data, timestamp: Date.now(), tags: memoryCached.tags };
    }

    return null; // cache miss
  }
}
```

#### Подблок 4.2: Теги — групповая инвалидация

```typescript
async set(key: string, data: any, ttlSeconds: number, tags: string[] = []) {
  // Сжатие ответов > 1KB
  const serialized = JSON.stringify({ data, timestamp: Date.now(), tags });
  let finalData: string;
  if (serialized.length > this.compressionThreshold) {
    const compressed = await gzipAsync(Buffer.from(serialized, 'utf8'));
    finalData = 'gz:' + compressed.toString('base64');
  } else {
    finalData = serialized;
  }

  // Redis: ключ + теги через pipeline (атомарно)
  await redisClient.setEx(key, ttlSeconds, finalData);
  if (tags.length > 0) {
    const pipeline = redisClient.multi();
    for (const tag of tags) {
      pipeline.sAdd(`cache:tag:${tag}`, key);          // SET тега → ключи
      pipeline.expire(`cache:tag:${tag}`, ttlSeconds + 3600); // теги живут дольше
    }
    await pipeline.exec();
  }
}

// Инвалидация по тегам — удаляем все ключи с тегом
async invalidateByTags(tags: string[]): Promise<number> {
  const pipeline = redisClient.multi();
  const keysToDelete: string[] = [];

  for (const tag of tags) {
    const keys = await redisClient.sMembers(`cache:tag:${tag}`); // все ключи тега
    keysToDelete.push(...keys);
    pipeline.del(`cache:tag:${tag}`); // удаляем сам тег
  }

  if (keysToDelete.length > 0) pipeline.del(keysToDelete);
  await pipeline.exec();
  // → EventBus: articles.collected → invalidateByTags(['news'])
}
```

#### Подблок 4.3: Готовые middleware + stale-while-revalidate

```typescript
// Готовые конфигурации для разных endpoint'ов
export const cacheMiddlewares = {
  // Лента новостей: 5 мин, stale-while-revalidate 60 сек
  newsList: queryCacheService.createCacheMiddleware({
    ttl: 300,
    keyPrefix: 'news:list',
    tags: ['news'],
    varyBy: ['x-browser-id'],       // разный кэш для разных браузеров
    staleWhileRevalidate: 60,       // отдаём устаревшее, обновляем в фоне
  }),

  // Поиск: 2 мин, пропускаем если запрос < 3 символов
  newsSearch: queryCacheService.createCacheMiddleware({
    ttl: 120,
    keyPrefix: 'news:search',
    tags: ['news', 'search'],
    skipCache: (req) => !req.query.q || String(req.query.q).length < 3,
  }),

  // Источники: 1 час (меняются редко)
  sources: queryCacheService.createCacheMiddleware({
    ttl: 3600,
    keyPrefix: 'news:sources',
    tags: ['sources'],
  }),
};

// stale-while-revalidate:
// Запрос пришёл, данные устарели (> 60 сек) но ещё не истекли (< 300 сек)
// → отдаём устаревшие данные НЕМЕДЛЕННО (быстро для пользователя)
// → setImmediate: удаляем ключ из кэша
// → следующий запрос получит свежие данные
```

#### Подблок 4.4: Заголовки кэша и Connection Pool

```typescript
// Заголовки в ответе — видны в DevTools
res.setHeader('X-Cache', 'HIT');    // или 'MISS' / 'ERROR'
res.setHeader('X-Cache-Key', cacheKey);
res.setHeader('X-Cache-Status', 'FRESH'); // или 'STALE'

// db.ts — Connection Pool
export const pool = new Pool({
  connectionString: dbConfig.connectionString,
  ssl: dbConfig.ssl,
  max: dbConfig.max,          // максимум соединений
  min: 2,                     // минимум — всегда готовы 2 соединения
  idleTimeoutMillis: dbConfig.idleTimeoutMillis,
  connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
});

// Retry с экспоненциальной задержкой при старте
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
// ECONNREFUSED → redisEnabled = false → null
// Приложение работает без Redis (только in-memory кэш)
```

---

### 🎓 Заключение (1 минута)

**Ведущий:**
> Итоги базы данных и производительности:

1. **Drizzle ORM** — типобезопасная схема, customType для tsvector, jsonb для NER
2. **GIN-индекс** — полнотекстовый поиск на русском и английском, триггер tsvector_update
3. **Repository Pattern** — onConflictDoNothing, параллельные запросы, jsonb_array_elements_text
4. **Архивирование** — двухэтапное: isArchived=true → физическое удаление через 14 дней
5. **Двухуровневый кэш** — Redis → in-memory, теги, gzip сжатие, stale-while-revalidate

> В следующем эпизоде — деплой и DevOps: Docker Compose, Nginx, PM2, автоматические бэкапы GFS.

---

## 🎥 Технические требования

### Файлы для демонстрации
```
shared/types/schema.ts                              ← Блок 1: 18 таблиц, типы
server/db/db.ts                                     ← Блок 1: Pool, retry
server/db/redis.ts                                  ← Блок 4: graceful degradation
server/infrastructure/persistence/
  NewsArticleRepository.ts                          ← Блок 2+3: поиск, фильтрация, архив
server/infrastructure/monitoring/
  QueryCacheService.ts                              ← Блок 4: двухуровневый кэш
```

### Демо в браузере и терминале
```bash
# Полнотекстовый поиск
curl "http://localhost:5000/api/news/search?q=Путин" | jq '.articles | length'

# Заголовки кэша
curl -I "http://localhost:5000/api/news" | grep -i "x-cache"

# Статистика кэша
curl http://localhost:5000/api/admin/cache/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Инвалидация кэша
curl -X POST http://localhost:5000/api/admin/cache/clear \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
