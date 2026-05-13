import { db } from '../../db/db';
import { articleEmotions } from '../../../shared/types/schema';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import type { ArticleEmotionId } from '../../../shared/constants/articleEmotions';

export type EmotionTotals = Record<string, number>;

export const articleEmotionRepository = {
  /**
   * Первая эмодзи — INSERT; смена эмодзи — UPDATE emotion_id для той же пары article + daily_hash.
   * Повторный выбор той же эмодзи — без изменений в БД.
   * Возвращает актуальные суммы по статье для ответа API.
   */
  async upsertEmotion(
    articleId: number,
    emotionId: ArticleEmotionId,
    dailyHash: string
  ): Promise<EmotionTotals> {
    if (!dailyHash) return {};

    const [existing] = await db
      .select({ id: articleEmotions.id, emotionId: articleEmotions.emotionId })
      .from(articleEmotions)
      .where(and(eq(articleEmotions.articleId, articleId), eq(articleEmotions.dailyHash, dailyHash)))
      .limit(1);

    if (!existing) {
      await db.insert(articleEmotions).values({ articleId, emotionId, dailyHash }).onConflictDoNothing({
        target: [articleEmotions.articleId, articleEmotions.dailyHash],
      });
    } else if (existing.emotionId !== emotionId) {
      await db.update(articleEmotions).set({ emotionId }).where(eq(articleEmotions.id, existing.id));
    }

    const batch = await this.getTotalsPerArticleBatch([articleId]);
    return batch.get(articleId) ?? {};
  },

  async getMyEmotions(articleIds: number[], dailyHash: string): Promise<Map<number, string>> {
    if (!articleIds.length || !dailyHash) return new Map();
    const rows = await db
      .select({ articleId: articleEmotions.articleId, emotionId: articleEmotions.emotionId })
      .from(articleEmotions)
      .where(and(inArray(articleEmotions.articleId, articleIds), eq(articleEmotions.dailyHash, dailyHash)));
    return new Map(rows.map(r => [r.articleId, r.emotionId]));
  },

  async getTotalsPerArticleBatch(articleIds: number[]): Promise<Map<number, EmotionTotals>> {
    const out = new Map<number, EmotionTotals>();
    if (!articleIds.length) return out;
    const rows = await db
      .select({
        articleId: articleEmotions.articleId,
        emotionId: articleEmotions.emotionId,
        cnt: sql<number>`count(*)::int`,
      })
      .from(articleEmotions)
      .where(inArray(articleEmotions.articleId, articleIds))
      .groupBy(articleEmotions.articleId, articleEmotions.emotionId);
    for (const r of rows) {
      const m = out.get(r.articleId) ?? {};
      m[r.emotionId] = r.cnt;
      out.set(r.articleId, m);
    }
    return out;
  },

  async getSummaryTotals(hours = 24): Promise<EmotionTotals> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await db
      .select({
        emotionId: articleEmotions.emotionId,
        cnt: sql<number>`count(*)::int`,
      })
      .from(articleEmotions)
      .where(gte(articleEmotions.createdAt, since))
      .groupBy(articleEmotions.emotionId);
    const o: EmotionTotals = {};
    for (const r of rows) o[r.emotionId] = r.cnt;
    return o;
  },
};
