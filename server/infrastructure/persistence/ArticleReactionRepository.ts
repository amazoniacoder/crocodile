import { db } from '../../db/db';
import { articleReactions, articleEmotions, newsArticles, newsSources } from '../../../shared/types/schema';
import type { ArticleEmotionId } from '../../../shared/constants/articleEmotions';
import { eq, sql, desc, inArray, and, gte } from 'drizzle-orm';

export const articleReactionRepository = {
  async insert(articleId: number, type: 'like' | 'dislike', dailyHash: string): Promise<void> {
    const existing = await db
      .select({ id: articleReactions.id, type: articleReactions.type })
      .from(articleReactions)
      .where(sql`${articleReactions.articleId} = ${articleId} AND ${articleReactions.dailyHash} = ${dailyHash}`)
      .limit(1);

    const prev = existing[0];

    if (prev) {
      if (prev.type === type) return;
      await db.delete(articleReactions).where(eq(articleReactions.id, prev.id));
      await db.insert(articleReactions).values({ articleId, type, dailyHash });
      if (prev.type === 'like') {
        await db.update(newsArticles).set({ likesCount: sql`likes_count - 1`, dislikesCount: sql`dislikes_count + 1` }).where(eq(newsArticles.id, articleId));
      } else {
        await db.update(newsArticles).set({ dislikesCount: sql`dislikes_count - 1`, likesCount: sql`likes_count + 1` }).where(eq(newsArticles.id, articleId));
      }
    } else {
      await db.insert(articleReactions).values({ articleId, type, dailyHash });
      if (type === 'like') {
        await db.update(newsArticles).set({ likesCount: sql`likes_count + 1` }).where(eq(newsArticles.id, articleId));
      } else {
        await db.update(newsArticles).set({ dislikesCount: sql`dislikes_count + 1` }).where(eq(newsArticles.id, articleId));
      }
    }
  },

  async getCounts(articleId: number): Promise<{ likes: number; dislikes: number }> {
    const [row] = await db
      .select({ likes: newsArticles.likesCount, dislikes: newsArticles.dislikesCount })
      .from(newsArticles)
      .where(eq(newsArticles.id, articleId))
      .limit(1);
    return { likes: row?.likes ?? 0, dislikes: row?.dislikes ?? 0 };
  },

  async getMyReactions(articleIds: number[], dailyHash: string): Promise<Map<number, string>> {
    if (!articleIds.length || !dailyHash) return new Map();
    const rows = await db
      .select({ articleId: articleReactions.articleId, type: articleReactions.type })
      .from(articleReactions)
      .where(and(inArray(articleReactions.articleId, articleIds), eq(articleReactions.dailyHash, dailyHash)));
    return new Map(rows.map(r => [r.articleId, r.type]));
  },

  async getCountsBatch(articleIds: number[]): Promise<Map<number, { likes: number; dislikes: number }>> {
    if (!articleIds.length) return new Map();
    const rows = await db
      .select({ id: newsArticles.id, likes: newsArticles.likesCount, dislikes: newsArticles.dislikesCount })
      .from(newsArticles)
      .where(inArray(newsArticles.id, articleIds));
    return new Map(rows.map(r => [r.id, { likes: r.likes ?? 0, dislikes: r.dislikes ?? 0 }]));
  },

  async getTopByLikes(hours = 24, limit = 3): Promise<{
    articleId: number; title: string; sourceName: string;
    url: string; imageUrl: string | null; publishedAt: Date;
    region: string; category: string; likes: number;
  }[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await db
      .select({
        articleId:   articleReactions.articleId,
        title:       newsArticles.title,
        sourceName:  newsSources.name,
        url:         newsArticles.url,
        imageUrl:    newsArticles.imageUrl,
        publishedAt: newsArticles.publishedAt,
        region:      newsArticles.region,
        category:    newsArticles.category,
        likes:       sql<number>`count(*)::int`,
      })
      .from(articleReactions)
      .innerJoin(newsArticles, eq(articleReactions.articleId, newsArticles.id))
      .leftJoin(newsSources, eq(newsArticles.sourceId, newsSources.id))
      .where(and(eq(articleReactions.type, 'like'), gte(articleReactions.createdAt, since)))
      .groupBy(articleReactions.articleId, newsArticles.title, newsSources.name, newsArticles.url, newsArticles.imageUrl, newsArticles.publishedAt, newsArticles.region, newsArticles.category)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);
    return rows as any[];
  },

  async getSummary(hours = 24): Promise<{ likes: number; dislikes: number }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const [row] = await db
      .select({
        likes:    sql<number>`sum(case when ${articleReactions.type} = 'like'    then 1 else 0 end)::int`,
        dislikes: sql<number>`sum(case when ${articleReactions.type} = 'dislike' then 1 else 0 end)::int`,
      })
      .from(articleReactions)
      .where(gte(articleReactions.createdAt, since));
    return { likes: (row as any)?.likes ?? 0, dislikes: (row as any)?.dislikes ?? 0 };
  },

  async getTopByLikesAdmin(hours = 24, limit = 20): Promise<{
    articleId: number; title: string; likes: number; dislikes: number;
  }[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rows = await db
      .select({
        articleId: articleReactions.articleId,
        title:     newsArticles.title,
        likes:     sql<number>`sum(case when ${articleReactions.type} = 'like'    then 1 else 0 end)::int`,
        dislikes:  sql<number>`sum(case when ${articleReactions.type} = 'dislike' then 1 else 0 end)::int`,
      })
      .from(articleReactions)
      .innerJoin(newsArticles, eq(articleReactions.articleId, newsArticles.id))
      .where(gte(articleReactions.createdAt, since))
      .groupBy(articleReactions.articleId, newsArticles.title)
      .orderBy(desc(sql`sum(case when ${articleReactions.type} = 'like' then 1 else 0 end)`))
      .limit(limit);
    return rows as any[];
  },

  /** Статьи с реакциями или эмодзи в окне — разбивка по лайку/дизлайку и по типам эмодзи. */
  async getAdminCombinedTop(hours = 24, limit = 20): Promise<
    {
      articleId: number;
      title: string;
      likes: number;
      dislikes: number;
      emotions: Record<ArticleEmotionId | string, number>;
    }[]
  > {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [rArts, eArts] = await Promise.all([
      db
        .select({ articleId: articleReactions.articleId })
        .from(articleReactions)
        .where(gte(articleReactions.createdAt, since))
        .groupBy(articleReactions.articleId),
      db
        .select({ articleId: articleEmotions.articleId })
        .from(articleEmotions)
        .where(gte(articleEmotions.createdAt, since))
        .groupBy(articleEmotions.articleId),
    ]);

    const idSet = new Set<number>();
    for (const r of rArts) idSet.add(r.articleId);
    for (const r of eArts) idSet.add(r.articleId);
    const ids = [...idSet];
    if (!ids.length) return [];

    const titles = await db
      .select({ id: newsArticles.id, title: newsArticles.title })
      .from(newsArticles)
      .where(inArray(newsArticles.id, ids));
    const titleMap = new Map(titles.map(t => [t.id, t.title]));

    const reactAgg = await db
      .select({
        articleId: articleReactions.articleId,
        likes: sql<number>`sum(case when ${articleReactions.type} = 'like' then 1 else 0 end)::int`,
        dislikes: sql<number>`sum(case when ${articleReactions.type} = 'dislike' then 1 else 0 end)::int`,
      })
      .from(articleReactions)
      .where(and(inArray(articleReactions.articleId, ids), gte(articleReactions.createdAt, since)))
      .groupBy(articleReactions.articleId);

    const emoAgg = await db
      .select({
        articleId: articleEmotions.articleId,
        emotionId: articleEmotions.emotionId,
        cnt: sql<number>`count(*)::int`,
      })
      .from(articleEmotions)
      .where(and(inArray(articleEmotions.articleId, ids), gte(articleEmotions.createdAt, since)))
      .groupBy(articleEmotions.articleId, articleEmotions.emotionId);

    const reactMap = new Map(reactAgg.map(r => [r.articleId, { likes: r.likes ?? 0, dislikes: r.dislikes ?? 0 }]));
    const emotionMap = new Map<number, Record<string, number>>();
    for (const row of emoAgg) {
      const m = emotionMap.get(row.articleId) ?? {};
      m[row.emotionId] = row.cnt;
      emotionMap.set(row.articleId, m);
    }

    type RowOut = {
      articleId: number;
      title: string;
      likes: number;
      dislikes: number;
      emotions: Record<string, number>;
      score: number;
    };

    const out: RowOut[] = ids.map(articleId => {
      const r = reactMap.get(articleId) ?? { likes: 0, dislikes: 0 };
      const emotions = emotionMap.get(articleId) ?? {};
      const emoSum = Object.values(emotions).reduce((a, b) => a + (b ?? 0), 0);
      const score = r.likes + r.dislikes + emoSum;
      return {
        articleId,
        title: titleMap.get(articleId) ?? `Статья #${articleId}`,
        likes: r.likes,
        dislikes: r.dislikes,
        emotions,
        score,
      };
    });

    out.sort((a, b) => b.score - a.score);
    return out.slice(0, limit).map(({ score: _score, ...rest }) => rest);
  },

  async purgeAllReactionData(): Promise<{ deletedReactionRows: number; deletedEmotionRows: number }> {
    return db.transaction(async (tx) => {
      const reactionsRes = await tx.delete(articleReactions);
      const emotionsRes = await tx.delete(articleEmotions);
      await tx.update(newsArticles).set({ likesCount: 0, dislikesCount: 0 });
      return {
        deletedReactionRows: Number(reactionsRes.rowCount ?? 0),
        deletedEmotionRows: Number(emotionsRes.rowCount ?? 0),
      };
    });
  },
};
