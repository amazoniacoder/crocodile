import { logger } from '../../utils/logger';
import { db } from '../../db/db';
import { getRedisClient } from '../../db/redis';
import { nerService } from '../ner/NerService';
import { gracefulNerService } from '../ner/GracefulNerService';

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
    ner: ComponentHealth;
    gracefulNer: ComponentHealth;
  };
  timestamp: Date;
  uptime: number;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'critical' | 'unavailable';
  responseTime?: number;
  error?: string;
  details?: Record<string, any>;
}

export interface HealthCheckOptions {
  timeout: number;
  includeDetails: boolean;
}

/**
 * Сервис для мониторинга здоровья системы
 * 
 * Проверяет состояние всех критических компонентов:
 * - База данных PostgreSQL
 * - Redis кэш
 * - NER сервис
 * - Graceful NER degradation
 */
export class HealthMonitoringService {
  private readonly startTime = Date.now();
  private lastHealthCheck: SystemHealth | null = null;
  private healthCheckInProgress = false;

  /**
   * Выполняет полную проверку здоровья системы
   */
  async checkSystemHealth(options: Partial<HealthCheckOptions> = {}): Promise<SystemHealth> {
    const opts: HealthCheckOptions = {
      timeout: 5000,
      includeDetails: true,
      ...options
    };

    if (this.healthCheckInProgress) {
      return this.lastHealthCheck || this.getEmptyHealth();
    }

    this.healthCheckInProgress = true;

    try {
      const [database, redis, ner, gracefulNer] = await Promise.allSettled([
        this.checkDatabase(opts.timeout),
        this.checkRedis(opts.timeout),
        this.checkNerService(opts.timeout),
        this.checkGracefulNer(opts.timeout)
      ]);

      const health: SystemHealth = {
        overall: this.calculateOverallHealth([
          this.getResultValue(database),
          this.getResultValue(redis),
          this.getResultValue(ner),
          this.getResultValue(gracefulNer)
        ]),
        components: {
          database: this.getResultValue(database),
          redis: this.getResultValue(redis),
          ner: this.getResultValue(ner),
          gracefulNer: this.getResultValue(gracefulNer)
        },
        timestamp: new Date(),
        uptime: Date.now() - this.startTime
      };

      this.lastHealthCheck = health;
      return health;

    } finally {
      this.healthCheckInProgress = false;
    }
  }

  /**
   * Проверка здоровья базы данных
   */
  private async checkDatabase(timeout: number): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database health check timeout')), timeout);
      });

      const healthQuery = db.execute('SELECT 1 as health');
      await Promise.race([healthQuery, timeoutPromise]);

      const responseTime = Date.now() - startTime;

      // Дополнительные проверки
      const connectionCount = await this.getDatabaseConnectionCount();
      
      return {
        status: responseTime > 1000 ? 'degraded' : 'healthy',
        responseTime,
        details: {
          connectionCount,
          maxConnections: 100 // из конфигурации
        }
      };

    } catch (error) {
      return {
        status: 'critical',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown database error'
      };
    }
  }

  /**
   * Проверка здоровья Redis
   */
  private async checkRedis(timeout: number): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      const redisClient = await getRedisClient();
      if (!redisClient) {
        return {
          status: 'unavailable',
          error: 'Redis not configured'
        };
      }

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Redis health check timeout')), timeout);
      });

      const pingResult = redisClient.ping();
      await Promise.race([pingResult, timeoutPromise]);

      const responseTime = Date.now() - startTime;

      // Дополнительные проверки
      const info = await redisClient.info('memory');
      const memoryUsage = this.parseRedisMemoryInfo(info);

      return {
        status: responseTime > 500 ? 'degraded' : 'healthy',
        responseTime,
        details: {
          memoryUsage,
          connected: true
        }
      };

    } catch (error) {
      return {
        status: 'critical',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown Redis error'
      };
    }
  }

  /**
   * Проверка здоровья NER сервиса
   */
  private async checkNerService(timeout: number): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('NER health check timeout')), timeout);
      });

      const healthCheck = nerService.healthCheck();
      const result = await Promise.race([healthCheck, timeoutPromise]);

      const responseTime = Date.now() - startTime;
      const metrics = nerService.getMetrics();

      if (!result.available) {
        return {
          status: 'unavailable',
          responseTime,
          error: result.error,
          details: {
            circuitBreakerState: metrics.circuitBreakerState,
            totalRequests: metrics.totalRequests,
            successRate: metrics.successfulRequests / Math.max(1, metrics.totalRequests)
          }
        };
      }

      const successRate = metrics.successfulRequests / Math.max(1, metrics.totalRequests);
      const status = successRate < 0.8 ? 'degraded' : 'healthy';

      return {
        status,
        responseTime,
        details: {
          circuitBreakerState: metrics.circuitBreakerState,
          totalRequests: metrics.totalRequests,
          successRate,
          averageResponseTime: metrics.averageResponseTime
        }
      };

    } catch (error) {
      return {
        status: 'critical',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown NER error'
      };
    }
  }

  /**
   * Проверка здоровья Graceful NER
   */
  private async checkGracefulNer(timeout: number): Promise<ComponentHealth> {
    try {
      const stats = gracefulNerService.getStats();
      
      let status: ComponentHealth['status'] = 'healthy';
      
      if (!stats.nerAvailable && !stats.fallbackEnabled) {
        status = 'critical';
      } else if (!stats.nerAvailable && stats.fallbackEnabled) {
        status = 'degraded';
      }

      return {
        status,
        details: {
          nerAvailable: stats.nerAvailable,
          fallbackEnabled: stats.fallbackEnabled,
          fallbackStrategy: stats.fallbackStrategy,
          lastCheck: stats.lastCheck
        }
      };

    } catch (error) {
      return {
        status: 'critical',
        error: error instanceof Error ? error.message : 'Unknown Graceful NER error'
      };
    }
  }

  /**
   * Вычисляет общее здоровье системы
   */
  private calculateOverallHealth(components: ComponentHealth[]): SystemHealth['overall'] {
    const criticalCount = components.filter(c => c.status === 'critical').length;
    const degradedCount = components.filter(c => c.status === 'degraded').length;

    if (criticalCount > 0) {
      return 'critical';
    }

    if (degradedCount > 0) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Извлекает значение из Promise.allSettled результата
   */
  private getResultValue<T>(result: PromiseSettledResult<T>): T {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    return {
      status: 'critical',
      error: result.reason?.message || 'Unknown error'
    } as T;
  }

  /**
   * Возвращает пустое состояние здоровья
   */
  private getEmptyHealth(): SystemHealth {
    return {
      overall: 'critical',
      components: {
        database: { status: 'unavailable' },
        redis: { status: 'unavailable' },
        ner: { status: 'unavailable' },
        gracefulNer: { status: 'unavailable' }
      },
      timestamp: new Date(),
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Получает количество подключений к базе данных
   */
  private async getDatabaseConnectionCount(): Promise<number> {
    try {
      const result = await db.execute(`
        SELECT count(*) as count 
        FROM pg_stat_activity 
        WHERE state = 'active'
      `);
      const row = result.rows[0] as Record<string, unknown> | undefined;
      return parseInt(String(row?.count ?? '0'));
    } catch {
      return 0;
    }
  }

  /**
   * Парсит информацию о памяти Redis
   */
  private parseRedisMemoryInfo(info: string): { used: number; peak: number } {
    const lines = info.split('\r\n');
    let used = 0;
    let peak = 0;

    for (const line of lines) {
      if (line.startsWith('used_memory:')) {
        used = parseInt(line.split(':')[1]) || 0;
      } else if (line.startsWith('used_memory_peak:')) {
        peak = parseInt(line.split(':')[1]) || 0;
      }
    }

    return { used, peak };
  }

  /**
   * Получает последнее состояние здоровья (кэшированное)
   */
  getLastHealthCheck(): SystemHealth | null {
    return this.lastHealthCheck;
  }

  /**
   * Проверяет, здорова ли система в целом
   */
  isSystemHealthy(): boolean {
    return this.lastHealthCheck?.overall === 'healthy';
  }

  /**
   * Получает время работы системы в миллисекундах
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }
}

// Singleton instance
export const healthMonitoringService = new HealthMonitoringService();