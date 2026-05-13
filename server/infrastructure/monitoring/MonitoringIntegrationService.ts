import { logger } from '../../utils/logger';
import { healthMonitoringService } from './HealthMonitoringService';
import { alertManager } from './AlertManager';
import { queryCacheService, cacheMiddlewares } from './QueryCacheService';
import { eventBus } from '../events/EventBus';

/**
 * Сервис для инициализации и управления всеми системами мониторинга
 */
export class MonitoringIntegrationService {
  private initialized = false;
  private shutdownHandlers: (() => Promise<void>)[] = [];

  /**
   * Инициализирует все системы мониторинга
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Monitoring systems already initialized');
      return;
    }

    try {
      logger.info('🔧 Initializing monitoring systems...');

      // Инициализируем систему алертинга
      await this.initializeAlerting();

      // Настраиваем интеграцию с событиями
      await this.setupEventIntegration();

      // Настраиваем graceful shutdown
      await this.setupGracefulShutdown();

      this.initialized = true;
      logger.info('✅ Monitoring systems initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize monitoring systems:', error);
      throw error;
    }
  }

  /**
   * Инициализирует систему алертинга
   */
  private async initializeAlerting(): Promise<void> {
    // AlertManager запускается автоматически при создании экземпляра
    // Добавляем обработчик для graceful shutdown
    this.shutdownHandlers.push(async () => {
      alertManager.stop();
    });

    logger.info('🚨 Alert manager started');
  }

  /**
   * Настраивает интеграцию с системой событий
   */
  private async setupEventIntegration(): Promise<void> {
    // Инвалидация кэша при сборе новостей
    eventBus.on('articles.collected', async (data) => {
      try {
        await queryCacheService.invalidateByTags(['news']);
        logger.debug('🗑️ Cache invalidated after articles collection');
      } catch (error) {
        logger.warn('Failed to invalidate cache after articles collection:', error);
      }
    });

    // Инвалидация кэша при обновлении кластеров
    eventBus.on('cluster.updated', async (data) => {
      try {
        await queryCacheService.invalidateByTags(['news', 'clusters']);
        logger.debug('🗑️ Cache invalidated after cluster update');
      } catch (error) {
        logger.warn('Failed to invalidate cache after cluster update:', error);
      }
    });

    // Инвалидация кэша при изменении источников
    eventBus.on('source.updated', async (data) => {
      try {
        await queryCacheService.invalidateByTags(['sources', 'news']);
        logger.debug('🗑️ Cache invalidated after source update');
      } catch (error) {
        logger.warn('Failed to invalidate cache after source update:', error);
      }
    });

    // Инвалидация кэша при изменении реакций
    eventBus.on('reaction.updated', async (data) => {
      try {
        await queryCacheService.invalidateByTags(['popular', 'reactions']);
        logger.debug('🗑️ Cache invalidated after reaction update');
      } catch (error) {
        logger.warn('Failed to invalidate cache after reaction update:', error);
      }
    });

    logger.info('🔗 Event integration configured');
  }

  /**
   * Настраивает graceful shutdown
   */
  private async setupGracefulShutdown(): Promise<void> {
    const shutdown = async (signal: string) => {
      logger.info(`📴 Received ${signal}, shutting down monitoring systems...`);
      
      try {
        // Выполняем все обработчики shutdown
        await Promise.all(this.shutdownHandlers.map(handler => handler()));
        
        logger.info('✅ Monitoring systems shut down gracefully');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during monitoring systems shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    logger.info('🛡️ Graceful shutdown configured');
  }

  /**
   * Получает статус всех систем мониторинга
   */
  async getSystemStatus(): Promise<{
    initialized: boolean;
    health: any;
    alerting: {
      monitoring: boolean;
      activeAlerts: number;
      rules: number;
    };
    cache: {
      available: boolean;
      stats: any;
    };
  }> {
    const health = await healthMonitoringService.checkSystemHealth();
    const alertStats = await alertManager.getAlertStats();
    const cacheInfo = await queryCacheService.getInfo();

    return {
      initialized: this.initialized,
      health,
      alerting: {
        monitoring: true,
        activeAlerts: alertStats.activeAlerts,
        rules: alertManager.getAllRules().length
      },
      cache: {
        available: cacheInfo.redisAvailable,
        stats: cacheInfo.stats
      }
    };
  }

  /**
   * Выполняет полную диагностику системы
   */
  async runDiagnostics(): Promise<{
    timestamp: Date;
    overall: 'healthy' | 'degraded' | 'critical';
    components: {
      monitoring: 'healthy' | 'degraded' | 'critical';
      alerting: 'healthy' | 'degraded' | 'critical';
      caching: 'healthy' | 'degraded' | 'critical';
    };
    recommendations: string[];
  }> {
    const health = await healthMonitoringService.checkSystemHealth();
    const alertStats = await alertManager.getAlertStats();
    const cacheStats = queryCacheService.getStats();
    
    const recommendations: string[] = [];
    
    // Анализируем состояние компонентов
    const monitoringStatus = health.overall;
    
    const alertingStatus = alertStats.activeAlerts > 5 ? 'degraded' : 'healthy';
    if (alertStats.activeAlerts > 5) {
      recommendations.push(`High number of active alerts (${alertStats.activeAlerts}). Review system health.`);
    }
    
    const cachingStatus = cacheStats.hitRate < 0.5 ? 'degraded' : 'healthy';
    if (cacheStats.hitRate < 0.5) {
      recommendations.push(`Low cache hit rate (${Math.round(cacheStats.hitRate * 100)}%). Consider adjusting TTL or cache keys.`);
    }
    
    if (cacheStats.errors > cacheStats.totalRequests * 0.1) {
      recommendations.push(`High cache error rate. Check Redis connectivity.`);
    }

    // Определяем общий статус
    const statuses = [monitoringStatus, alertingStatus, cachingStatus];
    const overall = statuses.includes('critical') ? 'critical' :
                   statuses.includes('degraded') ? 'degraded' : 'healthy';

    return {
      timestamp: new Date(),
      overall,
      components: {
        monitoring: monitoringStatus,
        alerting: alertingStatus,
        caching: cachingStatus
      },
      recommendations
    };
  }

  /**
   * Проверяет, инициализированы ли системы мониторинга
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
export const monitoringIntegrationService = new MonitoringIntegrationService();

// Экспортируем готовые middleware для использования в роутах
export { cacheMiddlewares };