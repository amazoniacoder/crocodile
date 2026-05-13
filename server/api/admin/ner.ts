import { Router } from 'express';
import { nerService } from '../../infrastructure/ner/NerService';
import { nerBatchProcessor } from '../../infrastructure/ner/NerBatchProcessor';
import { logger } from '../../utils/logger';
import { authenticateAdmin } from '../../middleware/security';

const router = Router();
router.use(authenticateAdmin);

/**
 * GET /api/admin/ner/metrics
 * Получение метрик NER сервиса и Circuit Breaker
 */
router.get('/metrics', async (req, res) => {
  try {
    const detailedMetrics = nerBatchProcessor.getDetailedMetrics();
    const healthCheck = await nerService.healthCheck();
    
    res.json({
      success: true,
      metrics: {
        ...detailedMetrics,
        healthCheck
      }
    });
  } catch (error) {
    logger.error('Failed to get NER metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve NER metrics'
    });
  }
});

/**
 * POST /api/admin/ner/circuit-breaker/reset
 * Принудительный сброс Circuit Breaker
 */
router.post('/circuit-breaker/reset', (req, res) => {
  try {
    nerBatchProcessor.resetCircuitBreaker();
    
    logger.info('🔄 Circuit Breaker reset by admin');
    
    res.json({
      success: true,
      message: 'Circuit Breaker has been reset'
    });
  } catch (error) {
    logger.error('Failed to reset Circuit Breaker:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset Circuit Breaker'
    });
  }
});

/**
 * GET /api/admin/ner/health
 * Проверка здоровья NER сервиса
 */
router.get('/health', async (req, res) => {
  try {
    const healthCheck = await nerService.healthCheck();
    const isAvailable = nerService.isAvailable();
    
    res.json({
      success: true,
      health: {
        ...healthCheck,
        circuitBreakerOpen: !isAvailable
      }
    });
  } catch (error) {
    logger.error('Failed to check NER health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check NER service health'
    });
  }
});

/**
 * GET /api/admin/ner/stats
 * Статистика работы NER сервиса
 */
router.get('/stats', (req, res) => {
  try {
    const batchMetrics = nerBatchProcessor.getMetrics();
    const nerMetrics = nerService.getMetrics();
    
    const stats = {
      batchProcessor: {
        currentBatchSize: batchMetrics.currentBatchSize,
        queueLength: batchMetrics.queueLength,
        processing: batchMetrics.processing,
        avgProcessingTime: batchMetrics.avgProcessingTime,
        avgSuccessRate: `${(batchMetrics.avgSuccessRate * 100).toFixed(1)}%`,
        totalProcessed: batchMetrics.totalProcessed
      },
      nerService: {
        totalRequests: nerMetrics.totalRequests,
        successRate: nerMetrics.successfulRequests > 0 
          ? `${((nerMetrics.successfulRequests / nerMetrics.totalRequests) * 100).toFixed(1)}%`
          : '0%',
        averageResponseTime: `${nerMetrics.averageResponseTime.toFixed(0)}ms`,
        circuitBreaker: nerMetrics.circuitBreakerStats
      },
      status: {
        available: nerService.isAvailable(),
        circuitBreakerState: nerMetrics.circuitBreakerState
      }
    };
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Failed to get NER stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve NER statistics'
    });
  }
});

/**
 * GET /api/admin/ner/graceful
 * Получение статистики graceful degradation
 */
router.get('/graceful', async (req, res) => {
  try {
    const { gracefulNerService } = await import('../../infrastructure/ner/GracefulNerService');
    const stats = gracefulNerService.getStats();
    
    res.json({
      success: true,
      gracefulDegradation: stats
    });
  } catch (error) {
    logger.error('Failed to get graceful NER stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve graceful degradation stats'
    });
  }
});

/**
 * POST /api/admin/ner/graceful/health-check
 * Принудительная проверка здоровья NER сервиса
 */
router.post('/graceful/health-check', async (req, res) => {
  try {
    const { gracefulNerService } = await import('../../infrastructure/ner/GracefulNerService');
    const isAvailable = await gracefulNerService.forceHealthCheck();
    
    res.json({
      success: true,
      nerAvailable: isAvailable,
      message: isAvailable ? 'NER service is available' : 'NER service is unavailable'
    });
  } catch (error) {
    logger.error('Failed to check NER health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check NER service health'
    });
  }
});

/**
 * POST /api/admin/ner/graceful/fallback
 * Управление fallback режимом
 */
router.post('/graceful/fallback', async (req, res) => {
  try {
    const { enabled, strategy } = req.body;
    const { gracefulNerService } = await import('../../infrastructure/ner/GracefulNerService');
    
    if (typeof enabled === 'boolean') {
      gracefulNerService.setFallbackEnabled(enabled);
    }
    
    if (strategy && ['empty', 'simple', 'keyword'].includes(strategy)) {
      gracefulNerService.setFallbackStrategy(strategy);
    }
    
    const stats = gracefulNerService.getStats();
    
    res.json({
      success: true,
      message: 'Fallback settings updated',
      gracefulDegradation: stats
    });
  } catch (error) {
    logger.error('Failed to update fallback settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update fallback settings'
    });
  }
});

export default router;