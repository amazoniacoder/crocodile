import { Router } from 'express';
import { authenticateAdmin } from '../../../middleware/security';
import { logger } from '../../../utils/logger';

const router = Router();

/**
 * POST /api/admin/jobs/hot-entities
 * Manually trigger Hot Entities job
 */
router.post('/hot-entities', authenticateAdmin, async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Import HotEntitiesJob dynamically to avoid circular dependencies
    const { executeHotEntitiesJob } = await import('../../../application/news/HotEntitiesJob');
    
    logger.info('🔥 Manual Hot Entities job started by admin');
    
    const result = await executeHotEntitiesJob();
    const duration = Date.now() - startTime;

    const { queryCacheService } = await import('../../../infrastructure/monitoring/QueryCacheService');
    await queryCacheService.invalidateByTags(['news']);
    logger.info(`🧹 Hot entities cache invalidated`);

    logger.info(`🔥 Manual Hot Entities job completed in ${duration}ms`, {
      entitiesProcessed: result.count,
      duration
    });
    
    res.json({
      success: true,
      message: 'Hot Entities job executed successfully',
      data: {
        entitiesProcessed: result.count,
        duration,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Manual Hot Entities job failed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Job execution failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/jobs/rss-collect
 * Manually trigger RSS collection
 */
router.post('/rss-collect', authenticateAdmin, async (req, res) => {
  try {
    const { group = 'all' } = req.body;
    if (!['fast', 'slow', 'all', 'telegram', 'youtube'].includes(group)) {
      return res.status(400).json({ success: false, error: 'Invalid group' });
    }
    const startTime = Date.now();
    
    const { collectNewsUseCase } = await import('../../../application/news/CollectNewsUseCase');
    
    logger.info(`📰 Manual RSS collection started by admin (group: ${group})`);
    
    const articlesCollected = await collectNewsUseCase.execute(group as 'fast' | 'slow' | 'all');
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      message: 'RSS collection executed successfully',
      data: {
        articlesCollected,
        group,
        duration,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Manual RSS collection failed:', error);
    res.status(500).json({ 
      success: false,
      error: 'RSS collection failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/jobs/backfill-source-type
 * Обновить source_type для статей из Telegram-источников
 */
router.post('/backfill-source-type', authenticateAdmin, async (_req, res) => {
  try {
    const { db } = await import('../../../db/db');
    const { sql } = await import('drizzle-orm');

    const result = await db.execute(sql`
      UPDATE news_articles na
      SET
        source_type = ns.source_type,
        channel_username = CASE
          WHEN ns.source_type = 'telegram' AND na.url ~ 't\.me/([^/]+)/(\d+)'
          THEN substring(na.url FROM 't\.me/([^/]+)/')
          ELSE na.channel_username
        END,
        message_id = CASE
          WHEN ns.source_type = 'telegram' AND na.url ~ 't\.me/[^/]+/(\d+)'
          THEN (regexp_match(na.url, 't\.me/[^/]+/(\d+)'))[1]::integer
          ELSE na.message_id
        END
      FROM news_sources ns
      WHERE na.source_id = ns.id
        AND ns.source_type = 'telegram'
        AND na.source_type = 'rss'
    `);

    const updated = (result as any).rowCount ?? 0;
    logger.info(`✅ Backfill source_type: updated ${updated} articles`);

    res.json({ success: true, updated });
  } catch (error) {
    logger.error('Backfill source_type failed:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
