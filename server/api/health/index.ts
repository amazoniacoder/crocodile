import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { checkDatabaseConnection } from '../../db/db';
import { checkRedisConnection } from '../../db/redis';
import { logger } from '../../utils/logger';
import { db } from '../../db/db';
import { newsArticles, newsSources, newsClusters } from '../../../shared/types/schema';
import { eq, gte, sql } from 'drizzle-orm';

const router = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         responseTime:
 *                           type: string
 *                     redis:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         responseTime:
 *                           type: string
 *       503:
 *         description: Service is unhealthy
 */
router.get('/', asyncHandler(async (_, res) => {
  const startTime = Date.now();
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'unknown', responseTime: '0ms' },
      redis: { status: 'unknown', responseTime: '0ms' }
    },
    news: {
      activeSources: 0,
      lastCollectedAt: null as string | null,
      articlesLast24h: 0,
      clustersLast24h: 0,
    }
  };

  // Check database
  const dbStart = Date.now();
  const dbHealthy = await checkDatabaseConnection();
  healthCheck.services.database = {
    status: dbHealthy ? 'healthy' : 'unhealthy',
    responseTime: `${Date.now() - dbStart}ms`
  };

  // Check Redis
  const redisStart = Date.now();
  const redisHealthy = await checkRedisConnection();
  healthCheck.services.redis = {
    status: redisHealthy ? 'healthy' : 'unhealthy',
    responseTime: `${Date.now() - redisStart}ms`
  };

  // News aggregator metrics
  if (dbHealthy) {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [sourceCount, lastFetched, articleCount, clusterCount] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` })
        .from(newsSources)
        .where(eq(newsSources.isActive, true)),
      db.select({ lastFetchedAt: newsSources.lastFetchedAt })
        .from(newsSources)
        .where(eq(newsSources.isActive, true))
        .orderBy(sql`${newsSources.lastFetchedAt} DESC NULLS LAST`)
        .limit(1),
      db.select({ count: sql<number>`COUNT(*)` })
        .from(newsArticles)
        .where(gte(newsArticles.fetchedAt, since24h)),
      db.select({ count: sql<number>`COUNT(*)` })
        .from(newsClusters)
        .where(gte(newsClusters.lastSeenAt, since24h)),
    ]);

    healthCheck.news = {
      activeSources: Number(sourceCount[0]?.count ?? 0),
      lastCollectedAt: lastFetched[0]?.lastFetchedAt?.toISOString() ?? null,
      articlesLast24h: Number(articleCount[0]?.count ?? 0),
      clustersLast24h: Number(clusterCount[0]?.count ?? 0),
    };
  }

  // Overall health status
  const isHealthy = dbHealthy && redisHealthy;
  healthCheck.status = isHealthy ? 'healthy' : 'unhealthy';

  const statusCode = isHealthy ? 200 : 503;

  logger.info('Health check performed', {
    status: healthCheck.status,
    database: healthCheck.services.database.status,
    redis: healthCheck.services.redis.status,
    totalTime: `${Date.now() - startTime}ms`
  });

  res.status(statusCode).json(healthCheck);
}));

router.get('/ready', asyncHandler(async (_, res) => {
  const dbHealthy = await checkDatabaseConnection();
  
  if (dbHealthy) {
    res.status(200).json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready', reason: 'database unavailable' });
  }
}));

router.get('/live', (_, res) => {
  res.status(200).json({ status: 'alive' });
});

export default router;