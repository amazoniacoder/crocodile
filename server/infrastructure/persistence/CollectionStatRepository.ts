import { db } from '../../db/db';
import { collectionStats, newsSources } from '../../../shared/types/schema';
import { desc, gte, eq, sql } from 'drizzle-orm';
import type { NewCollectionStat, CollectionStat } from '../../domain/monitoring/CollectionStat';

export const collectionStatRepository = {
  async insert(stat: NewCollectionStat): Promise<void> {
    await db.insert(collectionStats).values(stat);
  },

  // Последние N записей по источнику
  async findBySource(sourceId: number, limit = 50): Promise<CollectionStat[]> {
    return db
      .select()
      .from(collectionStats)
      .where(eq(collectionStats.sourceId, sourceId))
      .orderBy(desc(collectionStats.collectedAt))
      .limit(limit) as Promise<CollectionStat[]>;
  },

  // Агрегат за последние N часов по каждому источнику (только активные)
  async aggregateLast24h(hours = 24): Promise<{
    sourceId: number | null;
    totalInserted: number;
    totalDuplicate: number;
    avgLatencyMs: number | null;
    avgFetchDurationMs: number | null;
    errorCount: number;
    lastCollectedAt: Date | null;
    lastError: string | null;
  }[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await db
      .select({
        sourceId: collectionStats.sourceId,
        totalInserted: sql<number>`sum(${collectionStats.articlesInserted})::int`,
        totalDuplicate: sql<number>`sum(${collectionStats.articlesDuplicate})::int`,
        avgLatencyMs: sql<number | null>`round(avg(${collectionStats.avgLatencyMs}))::int`,
        avgFetchDurationMs: sql<number | null>`round(avg(${collectionStats.fetchDurationMs}))::int`,
        errorCount: sql<number>`sum(${collectionStats.errorCount})::int`,
        lastCollectedAt: sql<Date>`max(${collectionStats.collectedAt})`,
        lastError: sql<string | null>`(array_agg(${collectionStats.lastError} order by ${collectionStats.collectedAt} desc))[1]`,
      })
      .from(collectionStats)
      .innerJoin(newsSources, eq(collectionStats.sourceId, newsSources.id))
      .where(sql`${collectionStats.collectedAt} >= ${since} AND ${newsSources.isActive} = true`)
      .groupBy(collectionStats.sourceId);
    return rows as any[];
  },

  // Данные для графика: количество статей по часам за последние N часов (только активные)
  async chartByHour(hours = 24): Promise<{
    sourceId: number | null;
    hour: Date;
    articlesInserted: number;
  }[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await db
      .select({
        sourceId: collectionStats.sourceId,
        hour: sql<Date>`date_trunc('hour', ${collectionStats.collectedAt})`,
        articlesInserted: sql<number>`sum(${collectionStats.articlesInserted})::int`,
      })
      .from(collectionStats)
      .innerJoin(newsSources, eq(collectionStats.sourceId, newsSources.id))
      .where(sql`${collectionStats.collectedAt} >= ${since} AND ${newsSources.isActive} = true`)
      .groupBy(collectionStats.sourceId, sql`date_trunc('hour', ${collectionStats.collectedAt})`)
      .orderBy(sql`date_trunc('hour', ${collectionStats.collectedAt})`);
    return rows as any[];
  },

  // Последние N циклов для графика времени выполнения (все источники суммарно)
  async recentCycleDurations(limit = 50): Promise<{
    collectedAt: Date;
    fetchDurationMs: number | null;
  }[]> {
    return db
      .select({
        collectedAt: collectionStats.collectedAt,
        fetchDurationMs: collectionStats.fetchDurationMs,
      })
      .from(collectionStats)
      .where(sql`${collectionStats.sourceId} is not null`)
      .orderBy(desc(collectionStats.collectedAt))
      .limit(limit) as any;
  },

  // Добавляем метод findSince для AlertingService
  async findSince(since: Date): Promise<CollectionStat[]> {
    return db
      .select()
      .from(collectionStats)
      .where(gte(collectionStats.collectedAt, since))
      .orderBy(desc(collectionStats.collectedAt)) as Promise<CollectionStat[]>;
  },

  // Удаление записей старше N дней (чистка)
  async deleteOlderThan(days = 7): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await db
      .delete(collectionStats)
      .where(sql`${collectionStats.collectedAt} < ${cutoff}`);
    return (result as any).rowCount ?? 0;
  },
};
