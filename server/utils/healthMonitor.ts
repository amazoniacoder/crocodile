import { checkDatabaseConnection } from '../db/db';
import { checkRedisConnection } from '../db/redis';
import { logger } from './logger';

export class HealthMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly checkInterval: number;

  constructor(intervalMinutes: number = 5) {
    this.checkInterval = intervalMinutes * 60 * 1000;
  }

  start() {
    if (this.intervalId) return;

    this.intervalId = setInterval(async () => {
      await this.performHealthCheck();
    }, this.checkInterval);

    logger.info('Health monitor started', { interval: `${this.checkInterval / 1000}s` });
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Health monitor stopped');
    }
  }

  private async performHealthCheck() {
    const dbHealthy = await checkDatabaseConnection();
    const redisHealthy = await checkRedisConnection();

    const healthStatus = {
      database: dbHealthy ? 'healthy' : 'unhealthy',
      redis: redisHealthy ? 'healthy' : 'unhealthy',
      overall: dbHealthy && redisHealthy ? 'healthy' : 'unhealthy'
    };

    if (!dbHealthy || !redisHealthy) {
      logger.error('Health check failed', healthStatus);
    } else {
      logger.debug('Health check passed', healthStatus);
    }
  }
}

export const healthMonitor = new HealthMonitor();