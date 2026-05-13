import { Router } from 'express';
import { healthMonitoringService } from '../../infrastructure/monitoring/HealthMonitoringService';
import { alertManager } from '../../infrastructure/monitoring/AlertManager';
import { queryCacheService } from '../../infrastructure/monitoring/QueryCacheService';
import { authenticateAdmin } from '../../middleware/security';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/admin/monitoring/health
 */
router.get('/health', authenticateAdmin, async (req, res) => {
  try {
    const includeDetails = req.query.details === 'true';
    const timeout = parseInt(req.query.timeout as string) || 5000;
    
    const health = await healthMonitoringService.checkSystemHealth({
      includeDetails,
      timeout
    });
    
    res.json({
      success: true,
      health
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check system health'
    });
  }
});

/**
 * GET /api/admin/monitoring/health/last
 * Получить последнее кэшированное состояние здоровья
 */
router.get('/health/last', authenticateAdmin, (req, res) => {
  try {
    const lastHealth = healthMonitoringService.getLastHealthCheck();
    
    if (!lastHealth) {
      return res.status(404).json({
        success: false,
        error: 'No health check data available'
      });
    }
    
    res.json({
      success: true,
      health: lastHealth,
      uptime: healthMonitoringService.getUptime()
    });
  } catch (error) {
    logger.error('Last health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get last health check'
    });
  }
});

/**
 * GET /api/admin/monitoring/alerts
 * Получить алерты
 */
router.get('/alerts', authenticateAdmin, async (req, res) => {
  try {
    const activeOnly = req.query.active !== 'false';
    const alerts = activeOnly
      ? await alertManager.getActiveAlerts()
      : await alertManager.getAlertHistory(100);
    const stats = await alertManager.getAlertStats();
    res.json({ success: true, alerts, stats });
  } catch (error) {
    logger.error('Get alerts error:', error);
    res.status(500).json({ success: false, error: 'Failed to get alerts' });
  }
});

router.get('/alerts/rules', authenticateAdmin, (req, res) => {
  try {
    const rules = alertManager.getAllRules();
    res.json({ success: true, rules });
  } catch (error) {
    logger.error('Get alert rules error:', error);
    res.status(500).json({ success: false, error: 'Failed to get alert rules' });
  }
});

router.patch('/alerts/rules/:ruleId', authenticateAdmin, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled must be boolean' });
    }
    const success = await alertManager.toggleRule(ruleId, enabled);
    if (!success) return res.status(404).json({ success: false, error: 'Rule not found' });
    res.json({ success: true, message: `Rule ${ruleId} ${enabled ? 'enabled' : 'disabled'}` });
  } catch (error) {
    logger.error('Update alert rule error:', error);
    res.status(500).json({ success: false, error: 'Failed to update alert rule' });
  }
});

/**
 * GET /api/admin/monitoring/cache/stats
 * Получить статистику кэша
 */
router.get('/cache/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = queryCacheService.getStats();
    const info = await queryCacheService.getInfo();
    
    res.json({
      success: true,
      stats,
      info
    });
  } catch (error) {
    logger.error('Get cache stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats'
    });
  }
});

/**
 * POST /api/admin/monitoring/cache/invalidate
 * Инвалидировать кэш по тегам или паттерну
 */
router.post('/cache/invalidate', authenticateAdmin, async (req, res) => {
  try {
    const { tags, pattern } = req.body;
    
    let invalidatedCount = 0;
    
    if (tags && Array.isArray(tags)) {
      invalidatedCount = await queryCacheService.invalidateByTags(tags);
    } else if (pattern) {
      invalidatedCount = await queryCacheService.invalidateByPattern(pattern);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either tags array or pattern string is required'
      });
    }
    
    res.json({
      success: true,
      invalidatedCount,
      message: `Invalidated ${invalidatedCount} cache entries`
    });
  } catch (error) {
    logger.error('Cache invalidation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to invalidate cache'
    });
  }
});

/**
 * DELETE /api/admin/monitoring/cache
 * Очистить весь кэш
 */
router.delete('/cache', authenticateAdmin, async (req, res) => {
  try {
    await queryCacheService.clear();
    queryCacheService.resetStats();
    
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    logger.error('Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

/**
 * POST /api/admin/monitoring/cache/stats/reset
 * Сбросить статистику кэша
 */
router.post('/cache/stats/reset', authenticateAdmin, (req, res) => {
  try {
    queryCacheService.resetStats();
    
    res.json({
      success: true,
      message: 'Cache stats reset successfully'
    });
  } catch (error) {
    logger.error('Reset cache stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset cache stats'
    });
  }
});

/**
 * GET /api/admin/monitoring/rate-limiters
 * Получить статистику rate limiters
 */
router.get('/rate-limiters', authenticateAdmin, (req, res) => {
  try {
    const { getRateLimiterStats } = require('../../middleware/apiKeyAuth');
    const stats = getRateLimiterStats();
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Get rate limiter stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rate limiter stats'
    });
  }
});

export default router;