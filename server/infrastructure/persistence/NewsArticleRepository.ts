import { db } from '../../db/db';
import { newsArticles, newsSources } from '../../../shared/types/schema';
import { eq, ne, desc, and, gte, lt, sql, inArray } from 'drizzle-orm';
import type { INewsArticleRepository, NewsArticleFilters } from '../../domain/news/repositories';
import type { NewsArticle, NewArticleInput, NewsCategory } from '../../domain/news/NewsArticle';
import type { ArticleEntities } from '../ner/NerService';

function toNewsArticle(row: typeof newsArticles.$inferSelect): NewsArticle & { entities?: any; sourceType?: string; channelUsername?: string | null; messageId?: number | null; videoId?: string | null } {
  return {
    id: row.id,
    sourceId: row.sourceId,
    title: row.title,
    description: row.description,
    imageUrl: row.imageUrl,
    url: row.url,
    publishedAt: row.publishedAt,
    fetchedAt: row.fetchedAt ?? new Date(),
    region: row.region as NewsArticle['region'],
    category: row.category as NewsArticle['category'],
    clusterId: row.clusterId,
    isArchived: row.isArchived ?? false,
    createdAt: row.createdAt ?? new Date(),
    likesCount: row.likesCount ?? 0,
    dislikesCount: row.dislikesCount ?? 0,
    entities: row.entities ?? null,
    sourceType: (row.sourceType ?? 'rss') as 'rss' | 'telegram' | 'youtube',
    channelUsername: row.channelUsername ?? null,
    messageId: row.messageId ?? null,
    videoId: (row as any).videoId ?? null,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDateParts = (value: string): { y: number; m: number; d: number } | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return {
    y: Number.parseInt(m[1], 10),
    m: Number.parseInt(m[2], 10),
    d: Number.parseInt(m[3], 10),
  };
};

const dayStartUtcForUserDate = (dateIso: string, tzOffsetMinutes = 0): Date | null => {
  const parts = parseDateParts(dateIso);
  if (!parts) return null;
  // timezoneOffset follows JS convention:
  // UTC = local + offsetMinutes (e.g. Tokyo => -540).
  const utcMs = Date.UTC(parts.y, parts.m - 1, parts.d) + tzOffsetMinutes * 60_000;
  return new Date(utcMs);
};

const nextDayStartUtc = (startUtc: Date): Date => new Date(startUtc.getTime() + DAY_MS);

export class NewsArticleRepository implements INewsArticleRepository {
  async insert(article: NewArticleInput): Promise<NewsArticle | null> {
    const [row] = await db
      .insert(newsArticles)
      .values({
        sourceId: article.sourceId,
        title: article.title,
        description: article.description,
        imageUrl: article.imageUrl,
        url: article.url,
        publishedAt: article.publishedAt,
        region: article.region,
        category: article.category,
        sourceType: article.sourceType ?? 'rss',
        channelUsername: article.channelUsername ?? null,
        messageId: article.messageId ?? null,
        videoId: (article as any).videoId ?? null,
      })
      .onConflictDoNothing({ target: newsArticles.url })
      .returning();
    return row ? toNewsArticle(row) : null;
  }

  async findById(id: number): Promise<NewsArticle | null> {
    const [row] = await db
      .select()
      .from(newsArticles)
      .where(and(eq(newsArticles.id, id), eq(newsArticles.isArchived, false)))
      .limit(1);
    return row ? toNewsArticle(row) : null;
  }

  async findUnclustered(since: Date): Promise<NewsArticle[]> {
    const rows = await db
      .select()
      .from(newsArticles)
      .where(
        sql`${newsArticles.clusterId} IS NULL
            AND ${newsArticles.publishedAt} >= ${since}
            AND ${newsArticles.fetchedAt} >= ${since}
            AND ${newsArticles.isArchived} = false`
      )
      .limit(500);
    return rows.map(toNewsArticle);
  }

  async assignCluster(articleIds: number[], clusterId: number): Promise<void> {
    await db
      .update(newsArticles)
      .set({ clusterId })
      .where(inArray(newsArticles.id, articleIds));
  }

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

  async findMany(filters: NewsArticleFilters, page: number, limit: number) {
    const conditions = [eq(newsArticles.isArchived, filters.isArchived ?? false)];

    // Фильтр по sourceType — через news_sources для надёжности
    if (filters.sourceType) {
      conditions.push(sql`${newsArticles.sourceId} IN (
        SELECT id FROM news_sources 
        WHERE source_type = ${filters.sourceType} 
          AND is_active = true 
          AND (is_private = false OR is_private IS NULL)
      )`);
    }

    if (filters.channelUsername) {
      conditions.push(eq(newsArticles.channelUsername, filters.channelUsername));
    }

    // Gate "приёма" — применяем до остальных фильтров.
    if (filters.enabledRussia === false) {
      conditions.push(ne(newsArticles.region, 'russia'));
    }
    if (filters.enabledWorld === false) {
      conditions.push(ne(newsArticles.region, 'world'));
    }
    if (filters.enabledCities === false) {
      conditions.push(sql`${newsArticles.sourceId} NOT IN (
        SELECT id FROM news_sources WHERE city IS NOT NULL
      )`);
    }

    if (filters.region && filters.region !== 'all') {
      conditions.push(eq(newsArticles.region, filters.region));
    }
    if (filters.category && (filters.category as string) !== 'all') {
      const cats = Array.isArray(filters.category)
        ? filters.category.filter((c): c is NewsCategory => (c as string) !== 'all')
        : [filters.category];
      if (cats.length === 1) {
        conditions.push(eq(newsArticles.category, cats[0]));
      } else if (cats.length > 1) {
        conditions.push(inArray(newsArticles.category, cats));
      }
    }
    if (filters.city) {
      conditions.push(sql`${newsArticles.sourceId} IN (
        SELECT id FROM news_sources WHERE city = ${filters.city} AND is_active = true
      )`);
    }
    if (filters.sourceIds?.length) {
      conditions.push(inArray(newsArticles.sourceId, filters.sourceIds));
    }
    const tzOffset = filters.tzOffsetMinutes ?? 0;
    if (filters.dateFrom || filters.dateTo) {
      if (filters.dateFrom) {
        const start = dayStartUtcForUserDate(filters.dateFrom, tzOffset);
        if (start) conditions.push(gte(newsArticles.publishedAt, start));
      }
      if (filters.dateTo) {
        const endStart = dayStartUtcForUserDate(filters.dateTo, tzOffset);
        if (endStart) conditions.push(lt(newsArticles.publishedAt, nextDayStartUtc(endStart)));
      }
    } else if (filters.date) {
      const dayStart = dayStartUtcForUserDate(filters.date, tzOffset);
      if (dayStart) {
        conditions.push(gte(newsArticles.publishedAt, dayStart));
        conditions.push(lt(newsArticles.publishedAt, nextDayStartUtc(dayStart)));
      }
    }

    const where = and(...conditions);
    const offset = (page - 1) * limit;

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(newsArticles).where(where)
        .orderBy(desc(newsArticles.publishedAt))
        .limit(limit).offset(offset),
      db.select({ count: sql<number>`COUNT(*)` }).from(newsArticles).where(where),
    ]);

    return { articles: rows.map(toNewsArticle), total: Number(count) };
  }

  async findByClusterId(clusterId: number): Promise<NewsArticle[]> {
    const rows = await db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.clusterId, clusterId))
      .orderBy(desc(newsArticles.publishedAt));
    return rows.map(toNewsArticle);
  }

  async findByClusterIdLimited(clusterId: number, limit: number, excludeId?: number): Promise<NewsArticle[]> {
    const conditions = [eq(newsArticles.clusterId, clusterId), eq(newsArticles.isArchived, false)];
    if (excludeId != null) conditions.push(ne(newsArticles.id, excludeId));
    const rows = await db
      .select()
      .from(newsArticles)
      .where(and(...conditions))
      .orderBy(desc(newsArticles.publishedAt))
      .limit(limit);
    return rows.map(toNewsArticle);
  }

  async findRecentByCategory(
    category: NewsArticle['category'],
    region: NewsArticle['region'],
    limit: number,
    excludeId?: number
  ): Promise<NewsArticle[]> {
    const conditions = [
      eq(newsArticles.isArchived, false),
      eq(newsArticles.category, category),
      eq(newsArticles.region, region),
    ];
    if (excludeId != null) conditions.push(ne(newsArticles.id, excludeId));
    const rows = await db
      .select()
      .from(newsArticles)
      .where(and(...conditions))
      .orderBy(desc(newsArticles.publishedAt))
      .limit(limit);
    return rows.map(toNewsArticle);
  }

  async search(
    query: string,
    limit: number,
    gate?: Pick<NewsArticleFilters, 'enabledRussia' | 'enabledWorld' | 'enabledCities'>
  ): Promise<NewsArticle[]> {
    const conditions: any[] = [
      eq(newsArticles.isArchived, false),
      sql`${newsArticles.searchVector} @@ (plainto_tsquery('russian', ${query}) || plainto_tsquery('english', ${query}))`,
    ];

    if (gate?.enabledRussia === false) conditions.push(ne(newsArticles.region, 'russia'));
    if (gate?.enabledWorld === false)  conditions.push(ne(newsArticles.region, 'world'));
    if (gate?.enabledCities === false) {
      conditions.push(sql`${newsArticles.sourceId} NOT IN (
        SELECT id FROM news_sources WHERE city IS NOT NULL
      )`);
    }

    const rows = await db
      .select()
      .from(newsArticles)
      .where(and(...conditions))
      .orderBy(sql`ts_rank(${newsArticles.searchVector}, plainto_tsquery('russian', ${query})) DESC`)
      .limit(limit);
    return rows.map(toNewsArticle);
  }

  async findRelatedByQuery(
    query: string,
    limit: number,
    opts: {
      excludeId?: number;
      region?: NewsArticle['region'];
      category?: NewsArticle['category'];
      mode?: 'phrase' | 'plain';
    } = {}
  ): Promise<NewsArticle[]> {
    const { excludeId, region, category, mode = 'plain' } = opts;
    const conditions: any[] = [eq(newsArticles.isArchived, false)];
    if (excludeId != null) conditions.push(ne(newsArticles.id, excludeId));
    if (region) conditions.push(eq(newsArticles.region, region));
    if (category) conditions.push(eq(newsArticles.category, category));

    // Use english+russian vectors (same as search), but prefer rank on russian for ordering.
    const tsq =
      mode === 'phrase'
        ? sql`phraseto_tsquery('russian', ${query}) || phraseto_tsquery('english', ${query})`
        : sql`plainto_tsquery('russian', ${query}) || plainto_tsquery('english', ${query})`;

    conditions.push(sql`${newsArticles.searchVector} @@ (${tsq})`);

    const rows = await db
      .select()
      .from(newsArticles)
      .where(and(...conditions))
      .orderBy(sql`ts_rank(${newsArticles.searchVector}, plainto_tsquery('russian', ${query})) DESC`)
      .limit(limit);

    return rows.map(toNewsArticle);
  }

  async updateEntities(id: number, entities: ArticleEntities): Promise<void> {
    await db
      .update(newsArticles)
      .set({ entities: entities as any })
      .where(eq(newsArticles.id, id));
  }

  async findByEntities(opts: {
    terms: string[];
    minMatches: number;
    since: Date;
    excludeId: number;
    limit: number;
  }): Promise<NewsArticle[]> {
    const { terms, minMatches, since, excludeId, limit } = opts;
    if (!terms.length) return [];

    // Улучшение 1: фильтр коротких терминов (ЦБ, УФ, и т.п.) — дают шумные совпадения
    // Аббревиатуры (США, ВСУ) пропускаем т.к. они в верхнем регистре и достаточно уникальны
    const filteredTerms = terms.filter(t => t.length >= 3 || t === t.toUpperCase());
    if (!filteredTerms.length) return [];

    // Улучшение 2: разбиваем многословные сущности на токены
    // «Дональд Трамп» → [«Дональд», «Трамп»] — совпадение по любому токену
    const expandedTerms = [...new Set(
      filteredTerms.flatMap(t => t.split(' ').filter(w => w.length >= 3 || w === w.toUpperCase()))
    )];
    if (!expandedTerms.length) return [];

    // Ищем только по FIRST кандидата — первая сущность в заголовке
    const matchExpr = expandedTerms
      .map(
        t => sql`(CASE WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(
            COALESCE(${newsArticles.entities}->'FIRST', '[]'::jsonb)
          ) AS e WHERE e ILIKE ${t}
        ) THEN 1 ELSE 0 END)`
      )
      .reduce((acc, c) => sql`${acc} + ${c}`);

    const rows = await db
      .select()
      .from(newsArticles)
      .where(
        and(
          eq(newsArticles.isArchived, false),
          ne(newsArticles.id, excludeId),
          gte(newsArticles.publishedAt, since),
          sql`${newsArticles.entities} IS NOT NULL`,
          sql`(${matchExpr}) >= ${minMatches}`
        )
      )
      .orderBy(sql`(${matchExpr}) DESC`, desc(newsArticles.publishedAt))
      .limit(limit);

    return rows.map(toNewsArticle);
  }

  async countSince(since: Date): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(newsArticles)
      .where(gte(newsArticles.fetchedAt, since));
    return Number(count);
  }

  async findRecentlyFetched(since: Date, limit: number): Promise<NewsArticle[]> {
    const rows = await db
      .select()
      .from(newsArticles)
      .where(and(
        gte(newsArticles.fetchedAt, since),
        eq(newsArticles.isArchived, false)
      ))
      .orderBy(desc(newsArticles.fetchedAt))
      .limit(limit);
    return rows.map(toNewsArticle);
  }

  async findSourceDisplay(
    sourceIds: number[]
  ): Promise<Map<number, { name: string; city: string | null; logoUrl: string | null; channelId: string | null }>> {
    if (!sourceIds.length) return new Map();
    const sources = await db
      .select({ id: newsSources.id, name: newsSources.name, city: newsSources.city, logoUrl: newsSources.logoUrl, rssUrl: newsSources.rssUrl })
      .from(newsSources)
      .where(inArray(newsSources.id, sourceIds));
    return new Map(sources.map(s => {
      const m = s.rssUrl?.match(/channel_id=([^&]+)/);
      return [s.id, { name: s.name, city: s.city, logoUrl: s.logoUrl ?? null, channelId: m ? m[1] : null }];
    }));
  }
}

export const newsArticleRepository = new NewsArticleRepository();
