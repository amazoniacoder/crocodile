import { db } from '../../db/db';
import { pageEvents, newsArticles, newsSources } from '../../../shared/types/schema';
import { desc, gte, eq, sql } from 'drizzle-orm';

export const pageEventRepository = {
  async insert(event: {
    type: 'pageview' | 'article_click';
    path?: string;
    articleId?: number;
    dailyHash?: string;
    country?: string | null;
    city?: string | null;
    deviceType?: string;
    referrerDomain?: string | null;
    durationSeconds?: number;
  }): Promise<void> {
    await db.insert(pageEvents).values(event);
  },

  // Pageviews + клики по часам за N часов
  async getByHour(hours = 24): Promise<{ hour: string; pageviews: number; clicks: number }[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await db
      .select({
        hour: sql<string>`to_char(date_trunc('hour', ${pageEvents.createdAt}), 'YYYY-MM-DD HH24:00')`,
        pageviews: sql<number>`sum(case when ${pageEvents.type} = 'pageview' then 1 else 0 end)::int`,
        clicks: sql<number>`sum(case when ${pageEvents.type} = 'article_click' then 1 else 0 end)::int`,
      })
      .from(pageEvents)
      .where(gte(pageEvents.createdAt, since))
      .groupBy(sql`date_trunc('hour', ${pageEvents.createdAt})`)
      .orderBy(sql`date_trunc('hour', ${pageEvents.createdAt})`);
    return rows as any[];
  },

  // Уникальные визиты по дням (по daily_hash)
  async getUniqueByDay(days = 30): Promise<{ date: string; uniques: number }[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${pageEvents.createdAt}), 'YYYY-MM-DD')`,
        uniques: sql<number>`count(distinct ${pageEvents.dailyHash})::int`,
      })
      .from(pageEvents)
      .where(sql`${pageEvents.createdAt} >= ${since} and ${pageEvents.dailyHash} is not null`)
      .groupBy(sql`date_trunc('day', ${pageEvents.createdAt})`)
      .orderBy(sql`date_trunc('day', ${pageEvents.createdAt})`);
    return rows as any[];
  },

  // Пиковые часы (средние события по часу суток за N дней)
  async getPeakHours(days = 7): Promise<{ hour: number; avgEvents: number }[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        hour: sql<number>`extract(hour from ${pageEvents.createdAt})::int`,
        avgEvents: sql<number>`round(count(*)::numeric / ${days}, 1)::float`,
      })
      .from(pageEvents)
      .where(gte(pageEvents.createdAt, since))
      .groupBy(sql`extract(hour from ${pageEvents.createdAt})`)
      .orderBy(sql`extract(hour from ${pageEvents.createdAt})`);
    return rows as any[];
  },

  // Топ статей по кликам
  async getTopArticles(hours = 24, limit = 20): Promise<{
    articleId: number;
    title: string;
    sourceName: string;
    url: string;
    imageUrl: string | null;
    publishedAt: Date;
    region: string;
    category: string;
    clicks: number;
  }[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await db
      .select({
        articleId: pageEvents.articleId,
        title: newsArticles.title,
        sourceName: newsSources.name,
        url: newsArticles.url,
        imageUrl: newsArticles.imageUrl,
        publishedAt: newsArticles.publishedAt,
        region: newsArticles.region,
        category: newsArticles.category,
        clicks: sql<number>`count(*)::int`,
      })
      .from(pageEvents)
      .innerJoin(newsArticles, eq(pageEvents.articleId, newsArticles.id))
      .leftJoin(newsSources, eq(newsArticles.sourceId, newsSources.id))
      .where(sql`${pageEvents.type} = 'article_click' and ${pageEvents.createdAt} >= ${since}`)
      .groupBy(pageEvents.articleId, newsArticles.title, newsSources.name, newsArticles.url, newsArticles.imageUrl, newsArticles.publishedAt, newsArticles.region, newsArticles.category)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);
    return rows as any[];
  },

  // Топ источников по кликам
  async getTopSources(hours = 24): Promise<{
    sourceName: string;
    region: string;
    clicks: number;
  }[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await db
      .select({
        sourceName: newsSources.name,
        region: newsSources.region,
        clicks: sql<number>`count(*)::int`,
      })
      .from(pageEvents)
      .innerJoin(newsArticles, eq(pageEvents.articleId, newsArticles.id))
      .innerJoin(newsSources, eq(newsArticles.sourceId, newsSources.id))
      .where(sql`${pageEvents.type} = 'article_click' and ${pageEvents.createdAt} >= ${since}`)
      .groupBy(newsSources.name, newsSources.region)
      .orderBy(desc(sql`count(*)`));
    return rows as any[];
  },

  // Сводка за N часов
  async getSummary(hours = 24): Promise<{
    pageviews: number;
    clicks: number;
    uniques: number;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const [row] = await db
      .select({
        pageviews: sql<number>`sum(case when ${pageEvents.type} = 'pageview' then 1 else 0 end)::int`,
        clicks: sql<number>`sum(case when ${pageEvents.type} = 'article_click' then 1 else 0 end)::int`,
        uniques: sql<number>`count(distinct ${pageEvents.dailyHash})::int`,
      })
      .from(pageEvents)
      .where(gte(pageEvents.createdAt, since));
    return {
      pageviews: (row as any)?.pageviews ?? 0,
      clicks: (row as any)?.clicks ?? 0,
      uniques: (row as any)?.uniques ?? 0,
    };
  },

  // Удаление событий старше N дней
  async deleteOlderThan(days = 90): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await db
      .delete(pageEvents)
      .where(sql`${pageEvents.createdAt} < ${cutoff}`);
    return (result as any).rowCount ?? 0;
  },

  // Удаление всех кликов по статьям
  async deleteAllClicks(): Promise<number> {
    const result = await db
      .delete(pageEvents)
      .where(eq(pageEvents.type, 'article_click'));
    return (result as any).rowCount ?? 0;
  },

  // География посетителей
  async getGeography(hours = 168): Promise<{ country: string; visits: number }[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await db
      .select({
        country: pageEvents.country,
        visits: sql<number>`count(*)::int`,
      })
      .from(pageEvents)
      .where(sql`${pageEvents.createdAt} >= ${since} and ${pageEvents.country} is not null`)
      .groupBy(pageEvents.country)
      .orderBy(desc(sql`count(*)`));
    return rows as any[];
  },

  // Аналитика конкретной статьи
  async getArticleAnalytics(articleId: number, hours = 168) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const [summary] = await db
      .select({
        clicks: sql<number>`count(*)::int`,
        uniqueVisitors: sql<number>`count(distinct ${pageEvents.dailyHash})::int`,
        avgDuration: sql<number>`round(avg(${pageEvents.durationSeconds}))::int`,
      })
      .from(pageEvents)
      .where(sql`${pageEvents.articleId} = ${articleId} and ${pageEvents.createdAt} >= ${since}`);
    
    const byHour = await db
      .select({
        hour: sql<string>`to_char(date_trunc('hour', ${pageEvents.createdAt}), 'YYYY-MM-DD HH24:00')`,
        clicks: sql<number>`count(*)::int`,
      })
      .from(pageEvents)
      .where(sql`${pageEvents.articleId} = ${articleId} and ${pageEvents.createdAt} >= ${since}`)
      .groupBy(sql`date_trunc('hour', ${pageEvents.createdAt})`)
      .orderBy(sql`date_trunc('hour', ${pageEvents.createdAt})`);
    
    return { summary, byHour };
  },

  // Топ страниц сайта
  async getTopPages(hours = 24): Promise<{ path: string; views: number; uniques: number }[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await db
      .select({
        path: pageEvents.path,
        views: sql<number>`count(*)::int`,
        uniques: sql<number>`count(distinct ${pageEvents.dailyHash})::int`,
      })
      .from(pageEvents)
      .where(sql`${pageEvents.type} = 'pageview' and ${pageEvents.createdAt} >= ${since} and ${pageEvents.path} is not null`)
      .groupBy(pageEvents.path)
      .orderBy(desc(sql`count(*)`));
    return rows as any[];
  },

  // Распределение по устройствам
  async getDevices(hours = 24): Promise<{ deviceType: string; count: number }[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await db
      .select({
        deviceType: pageEvents.deviceType,
        count: sql<number>`count(*)::int`,
      })
      .from(pageEvents)
      .where(sql`${pageEvents.createdAt} >= ${since} and ${pageEvents.deviceType} is not null`)
      .groupBy(pageEvents.deviceType)
      .orderBy(desc(sql`count(*)`));
    return rows as any[];
  },

  // Удаление всех событий аналитики
  async deleteAll(): Promise<number> {
    const result = await db.delete(pageEvents);
    return (result as any).rowCount ?? 0;
  },

  // Топ городов
  async getTopCities(hours = 168, limit = 20): Promise<{ city: string; country: string; visits: number }[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await db
      .select({
        city: pageEvents.city,
        country: pageEvents.country,
        visits: sql<number>`count(*)::int`,
      })
      .from(pageEvents)
      .where(sql`${pageEvents.createdAt} >= ${since} and ${pageEvents.city} is not null`)
      .groupBy(pageEvents.city, pageEvents.country)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);
    return rows as any[];
  },

  // Города по стране
  async getCitiesByCountry(countryCode: string, hours = 168): Promise<{ city: string; visits: number }[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await db
      .select({
        city: pageEvents.city,
        visits: sql<number>`count(*)::int`,
      })
      .from(pageEvents)
      .where(sql`${pageEvents.createdAt} >= ${since} and ${pageEvents.country} = ${countryCode} and ${pageEvents.city} is not null`)
      .groupBy(pageEvents.city)
      .orderBy(desc(sql`count(*)`))
      .limit(50);
    return rows as any[];
  },
};
