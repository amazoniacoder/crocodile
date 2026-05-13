import { db } from '../../db/db';
import { newsSources } from '../../../shared/types/schema';
import { eq, sql } from 'drizzle-orm';
import type { INewsSourceRepository } from '../../domain/news/repositories';
import type { NewsSource, NewSourceInput } from '../../domain/news/NewsSource';

function toNewsSource(row: typeof newsSources.$inferSelect): NewsSource {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    rssUrl: row.rssUrl,
    region: row.region as NewsSource['region'],
    category: row.category as NewsSource['category'],
    city: row.city ?? null,
    sourceType: (row.sourceType as 'rss' | 'telegram' | 'youtube') ?? 'rss',
    isActive: row.isActive ?? true,
    isFeatured: row.isFeatured ?? false,
    isPrivate: row.isPrivate ?? false,
    lastFetchedAt: row.lastFetchedAt ?? null,
    description: row.description ?? null,
    logoUrl: row.logoUrl ?? null,
    username: row.username ?? null,
    channelId: row.channelId ?? null,
    createdAt: row.createdAt ?? new Date(),
  };
}

export class NewsSourceRepository implements INewsSourceRepository {
  async findAllActive(): Promise<NewsSource[]> {
    const rows = await db.select().from(newsSources).where(eq(newsSources.isActive, true));
    return rows.map(toNewsSource);
  }

  async findAll(): Promise<NewsSource[]> {
    const rows = await db.select().from(newsSources).orderBy(newsSources.name);
    return rows.map(toNewsSource);
  }

  async findById(id: number): Promise<NewsSource | null> {
    const [row] = await db.select().from(newsSources).where(eq(newsSources.id, id)).limit(1);
    return row ? toNewsSource(row) : null;
  }

  async insert(source: NewSourceInput): Promise<NewsSource> {
    const [row] = await db.insert(newsSources).values({
      name: source.name,
      url: source.url,
      rssUrl: source.rssUrl,
      region: source.region,
      category: source.category,
      city: source.city,
      sourceType: source.sourceType || 'rss',
      isActive: source.isActive,
    }).returning();
    return toNewsSource(row);
  }

  async delete(id: number): Promise<void> {
    await db.delete(newsSources).where(eq(newsSources.id, id));
  }

  async update(
    id: number,
    fields: Partial<NewSourceInput & { 
      isActive: boolean; 
      isFeatured: boolean; 
      isPrivate: boolean;
      lastFetchedAt: Date;
      username: string | null;
      channelId: string | null;
    }>
  ): Promise<NewsSource | null> {
    const [row] = await db
      .update(newsSources)
      .set(fields)
      .where(eq(newsSources.id, id))
      .returning();
    return row ? toNewsSource(row) : null;
  }

  async getActiveCities(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ city: newsSources.city })
      .from(newsSources)
      .where(sql`${newsSources.city} IS NOT NULL AND ${newsSources.isActive} = true`)
      .orderBy(newsSources.city);
    return rows.map(r => r.city).filter(Boolean) as string[];
  }

  async countActive(): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(newsSources)
      .where(eq(newsSources.isActive, true));
    return Number(count);
  }

  async getLastFetchedAt(): Promise<Date | null> {
    const [row] = await db
      .select({ lastFetchedAt: newsSources.lastFetchedAt })
      .from(newsSources)
      .where(eq(newsSources.isActive, true))
      .orderBy(sql`${newsSources.lastFetchedAt} DESC NULLS LAST`)
      .limit(1);
    return row?.lastFetchedAt ?? null;
  }
}

export const newsSourceRepository = new NewsSourceRepository();
