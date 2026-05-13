# Примеры кода для Эпизода 9: "База данных и производительность"

> Все примеры взяты из реального кода проекта

---

## 🗄️ schema.ts — ключевые таблицы

```typescript
// shared/types/schema.ts

// customType — для типов которых нет в Drizzle
const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

export const newsArticles = pgTable('news_articles', {
  id:           serial('id').primaryKey(),
  sourceId:     integer('source_id').references(() => newsSources.id, { onDelete: 'set null' }),
  title:        text('title').notNull(),
  url:          text('url').notNull().unique(),        // UNIQUE — дедупликация
  publishedAt:  timestamp('published_at').notNull(),
  region:       varchar('region', { length: 20 }).notNull().default('russia'),
  category:     varchar('category', { length: 50 }).notNull().default('other'),
  clusterId:    integer('cluster_id').references(() => newsClusters.id, { onDelete: 'set null' }),
  isArchived:   boolean('is_archived').default(false),
  searchVector: tsvector('search_vector'),             // GIN-индекс
  entities:     jsonb('entities'),                     // { PER, ORG, LOC, FIRST }
  likesCount:   integer('likes_count').default(0).notNull(),
  sourceType:   varchar('source_type', { length: 20 }).notNull().default('rss'),
  videoId:      varchar('video_id', { length: 20 }),   // YouTube
  messageId:    integer('message_id'),                 // Telegram
});

// Анонимная аналитика — dailyHash вместо IP
export const pageEvents = pgTable('page_events', {
  dailyHash: varchar('daily_hash', { length: 16 }),
  // SHA256(IP + UserAgent + date)[:16] — IP не хранится
});

// API-ключи — только хэш
export const apiKeys = pgTable('api_keys', {
  keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),
  // Сам ключ не хранится — нельзя украсть из БД
});
```

---

## 🔍 Полнотекстовый поиск — SQL миграция

```sql
-- GIN-индекс
CREATE INDEX idx_news_articles_search_vector
ON news_articles USING GIN(search_vector);

-- Триггер автообновления
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

---

## 📦 NewsArticleRepository.ts — ключевые методы

```typescript
// server/infrastructure/persistence/NewsArticleRepository.ts

// Вставка с дедупликацией
async insert(article: NewArticleInput): Promise<NewsArticle | null> {
  const [row] = await db
    .insert(newsArticles)
    .values({ ...article })
    .onConflictDoNothing({ target: newsArticles.url })
    .returning();
  return row ? toNewsArticle(row) : null;
}

// Параллельные запросы — данные + COUNT
async findMany(filters: NewsArticleFilters, page: number, limit: number) {
  const conditions = [eq(newsArticles.isArchived, filters.isArchived ?? false)];

  // Несколько категорий
  if (filters.category && filters.category !== 'all') {
    const cats = Array.isArray(filters.category) ? filters.category : [filters.category];
    if (cats.length === 1) conditions.push(eq(newsArticles.category, cats[0]));
    else conditions.push(inArray(newsArticles.category, cats));
  }

  // Город через подзапрос
  if (filters.city) {
    conditions.push(sql`${newsArticles.sourceId} IN (
      SELECT id FROM news_sources WHERE city = ${filters.city} AND is_active = true
    )`);
  }

  // Дата с учётом часового пояса
  if (filters.dateFrom) {
    const start = dayStartUtcForUserDate(filters.dateFrom, filters.tzOffsetMinutes ?? 0);
    if (start) conditions.push(gte(newsArticles.publishedAt, start));
  }

  const where = and(...conditions);
  const [rows, [{ count }]] = await Promise.all([
    db.select().from(newsArticles).where(where)
      .orderBy(desc(newsArticles.publishedAt))
      .limit(limit).offset((page - 1) * limit),
    db.select({ count: sql<number>`COUNT(*)` }).from(newsArticles).where(where),
  ]);

  return { articles: rows.map(toNewsArticle), total: Number(count) };
}

// Полнотекстовый поиск
async search(query: string, limit: number): Promise<NewsArticle[]> {
  const rows = await db
    .select()
    .from(newsArticles)
    .where(and(
      eq(newsArticles.isArchived, false),
      sql`${newsArticles.searchVector} @@ (
        plainto_tsquery('russian', ${query}) ||
        plainto_tsquery('english', ${query})
      )`,
    ))
    .orderBy(sql`ts_rank(
      ${newsArticles.searchVector},
      plainto_tsquery('russian', ${query})
    ) DESC`)
    .limit(limit);
  return rows.map(toNewsArticle);
}

// Поиск по NER-сущностям через jsonb
async findByEntities(opts: { terms: string[], minMatches: number, since: Date, excludeId: number, limit: number }) {
  const { terms, minMatches, since, excludeId, limit } = opts;

  // Фильтр коротких терминов (аббревиатуры пропускаем)
  const filteredTerms = terms.filter(t => t.length >= 3 || t === t.toUpperCase());
  // Разбивка многословных сущностей
  const expandedTerms = [...new Set(
    filteredTerms.flatMap(t => t.split(' ').filter(w => w.length >= 3 || w === w.toUpperCase()))
  )];
  if (!expandedTerms.length) return [];

  const matchExpr = expandedTerms
    .map(t => sql`(CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(
        COALESCE(${newsArticles.entities}->'FIRST', '[]'::jsonb)
      ) AS e WHERE e ILIKE ${t}
    ) THEN 1 ELSE 0 END)`)
    .reduce((acc, c) => sql`${acc} + ${c}`);

  const rows = await db
    .select()
    .from(newsArticles)
    .where(and(
      eq(newsArticles.isArchived, false),
      ne(newsArticles.id, excludeId),
      gte(newsArticles.publishedAt, since),
      sql`${newsArticles.entities} IS NOT NULL`,
      sql`(${matchExpr}) >= ${minMatches}`,
    ))
    .orderBy(sql`(${matchExpr}) DESC`, desc(newsArticles.publishedAt))
    .limit(limit);

  return rows.map(toNewsArticle);
}

// Архивирование — двухэтапное
async archiveOlderThan(date: Date): Promise<number> {
  const result = await db
    .update(newsArticles)
    .set({ isArchived: true })
    .where(sql`${newsArticles.publishedAt} < ${date} AND ${newsArticles.isArchived} = false`);
  return result.rowCount ?? 0;
}

async deleteOlderThan(date: Date): Promise<number> {
  const result = await db
    .delete(newsArticles)
    .where(sql`${newsArticles.publishedAt} < ${date} AND ${newsArticles.isArchived} = true`);
  return result.rowCount ?? 0;
}
```

---

## ⚡ QueryCacheService.ts — двухуровневый кэш

```typescript
// server/infrastructure/monitoring/QueryCacheService.ts

export class QueryCacheService {
  private memoryCache = new Map<string, { data: any; expires: number; tags: string[] }>();
  private readonly maxMemoryCacheSize = 1000;
  private readonly compressionThreshold = 1024; // 1KB

  // Получение из кэша: Redis → in-memory
  async get(key: string) {
    const redisClient = await getRedisClient();
    if (redisClient) {
      const cached = await redisClient.get(key);
      if (cached) {
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
    return null;
  }

  // Сохранение с тегами и сжатием
  async set(key: string, data: any, ttlSeconds: number, tags: string[] = []) {
    const serialized = JSON.stringify({ data, timestamp: Date.now(), tags });
    let finalData: string;
    if (serialized.length > this.compressionThreshold) {
      const compressed = await gzipAsync(Buffer.from(serialized, 'utf8'));
      finalData = 'gz:' + compressed.toString('base64');
    } else {
      finalData = serialized;
    }

    const redisClient = await getRedisClient();
    if (redisClient) {
      await redisClient.setEx(key, ttlSeconds, finalData);
      if (tags.length > 0) {
        const pipeline = redisClient.multi();
        for (const tag of tags) {
          pipeline.sAdd(`cache:tag:${tag}`, key);
          pipeline.expire(`cache:tag:${tag}`, ttlSeconds + 3600);
        }
        await pipeline.exec();
      }
    }
    this.setMemoryCache(key, data, ttlSeconds, tags);
  }

  // Инвалидация по тегам
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidatedCount = 0;
    const redisClient = await getRedisClient();
    if (redisClient) {
      const pipeline = redisClient.multi();
      const keysToDelete: string[] = [];
      for (const tag of tags) {
        const keys = await redisClient.sMembers(`cache:tag:${tag}`);
        keysToDelete.push(...keys);
        pipeline.del(`cache:tag:${tag}`);
      }
      if (keysToDelete.length > 0) {
        pipeline.del(keysToDelete);
        invalidatedCount = keysToDelete.length;
      }
      await pipeline.exec();
    }
    // Инвалидируем in-memory
    for (const [key, cached] of this.memoryCache.entries()) {
      if (cached.tags.some(tag => tags.includes(tag))) {
        this.memoryCache.delete(key);
        invalidatedCount++;
      }
    }
    return invalidatedCount;
  }
}

// Готовые конфигурации
export const cacheMiddlewares = {
  newsList: queryCacheService.createCacheMiddleware({
    ttl: 300, keyPrefix: 'news:list', tags: ['news'],
    varyBy: ['x-browser-id'], staleWhileRevalidate: 60,
  }),
  newsSearch: queryCacheService.createCacheMiddleware({
    ttl: 120, keyPrefix: 'news:search', tags: ['news', 'search'],
    skipCache: (req) => !req.query.q || String(req.query.q).length < 3,
  }),
  sources: queryCacheService.createCacheMiddleware({
    ttl: 3600, keyPrefix: 'news:sources', tags: ['sources'],
  }),
};
```

---

## 🔌 db.ts + redis.ts — подключения

```typescript
// server/db/db.ts
export const pool = new Pool({
  connectionString: dbConfig.connectionString,
  ssl: dbConfig.ssl,
  max: dbConfig.max,
  min: 2,
  idleTimeoutMillis: dbConfig.idleTimeoutMillis,
  connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
});

export const db = drizzle(pool, {
  schema: { newsSources, newsArticles, newsClusters, userTokens, userChannelSubscriptions }
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
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, delay));
        delay *= 2; // 1s → 2s → 4s
      }
    }
  }
  return false;
}

// server/db/redis.ts — graceful degradation
let redisEnabled = true;

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (!redisEnabled) return null;
  // ...
  redisClient.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
      redisEnabled = false; // отключаем Redis
      redisClient = null;
    }
  });
}
```

---

*Все примеры соответствуют реальному production-коду проекта.*
