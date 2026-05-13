import { db } from '../../db/db';
import { newsClusters } from '../../../shared/types/schema';
import { eq, gte, sql } from 'drizzle-orm';
import type { INewsClusterRepository } from '../../domain/news/repositories';
import type { NewsCluster, NewClusterInput } from '../../domain/news/NewsCluster';

function toNewsCluster(row: typeof newsClusters.$inferSelect): NewsCluster {
  return {
    id: row.id,
    title: row.title,
    articleCount: row.articleCount ?? 1,
    region: row.region as NewsCluster['region'],
    category: row.category as NewsCluster['category'],
    firstSeenAt: row.firstSeenAt ?? new Date(),
    lastSeenAt: row.lastSeenAt ?? new Date(),
  };
}

export class NewsClusterRepository implements INewsClusterRepository {
  async insert(cluster: NewClusterInput): Promise<NewsCluster> {
    const [row] = await db.insert(newsClusters).values({
      title: cluster.title,
      articleCount: cluster.articleCount,
      region: cluster.region,
      category: cluster.category,
      firstSeenAt: cluster.firstSeenAt,
      lastSeenAt: cluster.lastSeenAt,
    }).returning();
    return toNewsCluster(row);
  }

  async findById(id: number): Promise<NewsCluster | null> {
    const [row] = await db.select().from(newsClusters).where(eq(newsClusters.id, id)).limit(1);
    return row ? toNewsCluster(row) : null;
  }

  async countSince(since: Date): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(newsClusters)
      .where(gte(newsClusters.lastSeenAt, since));
    return Number(count);
  }
}

export const newsClusterRepository = new NewsClusterRepository();
