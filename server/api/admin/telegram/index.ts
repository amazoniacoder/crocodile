import { Router } from 'express';
import sourcesRouter from './sources';
import subscriptionsRouter from './subscriptions';
import { asyncHandler } from '../../../middleware/errorHandler';
import { db } from '../../../db/db';
import { sql } from 'drizzle-orm';

const router = Router();

router.use('/', sourcesRouter);
router.use('/subscriptions', subscriptionsRouter);

// GET /api/admin/telegram/stats - статистика сбора по каналам
router.get('/stats', asyncHandler(async (req, res) => {
  const result = await db.execute(sql`
    SELECT 
      ns.name AS source_name,
      COUNT(na.id)::int AS articles_count,
      MAX(na.fetched_at) AS last_fetched,
      MIN(na.published_at) AS oldest_article,
      MAX(na.published_at) AS newest_article
    FROM news_articles na
    JOIN news_sources ns ON na.source_id = ns.id
    WHERE ns.source_type = 'telegram' AND ns.is_private = false
    GROUP BY ns.id, ns.name
    ORDER BY articles_count DESC
  `);

  const stats = result.rows.map(row => ({
    sourceName: row.source_name,
    articlesCount: row.articles_count,
    lastFetched: row.last_fetched,
    oldestArticle: row.oldest_article,
    newestArticle: row.newest_article,
  }));

  res.json({ stats });
}));

export default router;
