import { getRedisClient } from '../../db/redis';
import { logger } from '../../utils/logger';
import { distributedScheduler } from './DistributedScheduler';
import { webSocketManager } from './WebSocketManager';

interface HealthMetrics {
  nodeId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  lastCheck: Date;
  responseTime: number;
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    memoryTotal: number;
    activeConnections: number;
    uptime: number;
    loadAverage: number[];
  };
  services: {
    database: boolean;
    redis: boolean;
    rss: boolean;
    websocket: boolean;
  };
  errors: string[];
}

interface FailoverEvent {
  timestamp: Date;
  fromNode: string;
  toNode: string;
  reason: string;
  services: string[];
}

export class HealthCheckManager {
  private healthChecks = new Map<string, HealthMetrics>();
  private checkInterval: NodeJS.Timeout | null = null;
  private failoverHistory: FailoverEvent[] = [];
  private readonly CHECK_INTERVAL_MS = 15000; // 15 seconds
  private readonly UNHEALTHY_THRESHOLD = 3; // 3 failed checks
  private readonly DEGRADED_CPU_THRESHOLD = 80; // 80% CPU
  private readonly DEGRADED_MEMORY_THRESHOLD = 85; // 85% memory
  private readonly RESPONSE_TIME_THRESHOLD = 5000; // 5 seconds

  constructor() {
    this.startHealthChecks();
    
    // Cleanup on process exit
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.performHealthCheck(); // Initial check
    
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.CHECK_INTERVAL_MS);
    
    logger.info('🏥 Health check manager started');
  }

  /**
   * Stop health checks
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info('🏥 Health check manager stopped');
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    const nodeId = distributedScheduler.getNodeId();
    const errors: string[] = [];

    try {
      // Check system metrics
      const metrics = await this.getSystemMetrics();
      
      // Check services
      const services = await this.checkServices();
      
      // Collect any service errors
      if (!services.database) errors.push('Database connection failed');
      if (!services.redis) errors.push('Redis connection failed');
      if (!services.websocket) errors.push('WebSocket service unavailable');

      const responseTime = Date.now() - startTime;
      
      // Determine health status
      const status = this.determineHealthStatus(metrics, services, responseTime, errors);
      
      const healthMetrics: HealthMetrics = {
        nodeId,
        status,
        lastCheck: new Date(),
        responseTime,
        metrics,
        services,
        errors
      };

      // Store locally
      this.healthChecks.set(nodeId, healthMetrics);
      
      // Store in Redis for cluster visibility
      await this.storeHealthInRedis(healthMetrics);
      
      // Check for failover conditions
      if (status === 'unhealthy') {
        await this.handleUnhealthyNode(nodeId, errors);
      }
      
      logger.debug(`🏥 Health check completed: ${status} (${responseTime}ms)`);
    } catch (error) {
      logger.error('Health check failed:', error);
      errors.push(`Health check error: ${error}`);
      
      const healthMetrics: HealthMetrics = {
        nodeId,
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        metrics: await this.getSystemMetrics().catch(() => ({
          cpuUsage: 0,
          memoryUsage: 0,
          memoryTotal: 0,
          activeConnections: 0,
          uptime: 0,
          loadAverage: [0, 0, 0]
        })),
        services: {
          database: false,
          redis: false,
          rss: false,
          websocket: false
        },
        errors
      };
      
      this.healthChecks.set(nodeId, healthMetrics);
    }
  }

  /**
   * Get system metrics
   */
  private async getSystemMetrics(): Promise<HealthMetrics['metrics']> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Get WebSocket connections
    const wsStats = webSocketManager.getLocalConnectionStats();
    
    // Calculate CPU percentage (approximation)
    const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1000000) / (process.uptime() || 1) * 100;
    
    return {
      cpuUsage: Math.min(cpuPercent, 100),
      memoryUsage: memUsage.rss / 1024 / 1024, // MB
      memoryTotal: memUsage.rss + memUsage.heapTotal + memUsage.external, // Total allocated
      activeConnections: wsStats.activeConnections,
      uptime: process.uptime(),
      loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0]
    };
  }

  /**
   * Check individual services
   */
  private async checkServices(): Promise<HealthMetrics['services']> {
    const services = {
      database: false,
      redis: false,
      rss: false,
      websocket: false
    };

    // Check database
    try {
      const { db } = await import('../../db/db');
      await db.execute('SELECT 1');
      services.database = true;
    } catch (error) {
      logger.warn('Database health check failed:', error);
    }

    // Check Redis
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.ping();
        services.redis = true;
      }
    } catch (error) {
      logger.warn('Redis health check failed:', error);
    }

    // Check RSS collection capability
    try {
      // Simple check - can we import the use case?
      await import('../../application/news/CollectNewsUseCase');
      services.rss = true;
    } catch (error) {
      logger.warn('RSS service health check failed:', error);
    }

    // Check WebSocket service
    try {
      const stats = webSocketManager.getLocalConnectionStats();
      services.websocket = stats !== null;
    } catch (error) {
      logger.warn('WebSocket health check failed:', error);
    }

    return services;
  }

  /**
   * Determine overall health status
   */
  private determineHealthStatus(
    metrics: HealthMetrics['metrics'],
    services: HealthMetrics['services'],
    responseTime: number,
    errors: string[]
  ): HealthMetrics['status'] {
    // Critical services must be working
    if (!services.database) return 'unhealthy';
    
    // Too many errors
    if (errors.length > 2) return 'unhealthy';
    
    // Response time too high
    if (responseTime > this.RESPONSE_TIME_THRESHOLD) return 'unhealthy';
    
    // Check for degraded performance
    const memoryPercent = (metrics.memoryUsage / metrics.memoryTotal) * 100;
    
    if (metrics.cpuUsage > this.DEGRADED_CPU_THRESHOLD || 
        memoryPercent > this.DEGRADED_MEMORY_THRESHOLD ||
        !services.redis) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Store health metrics in Redis
   */
  private async storeHealthInRedis(health: HealthMetrics): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (!redis) return;

      const healthData = {
        nodeId: health.nodeId,
        status: health.status,
        lastCheck: health.lastCheck.toISOString(),
        responseTime: health.responseTime.toString(),
        cpuUsage: health.metrics.cpuUsage.toString(),
        memoryUsage: health.metrics.memoryUsage.toString(),
        activeConnections: health.metrics.activeConnections.toString(),
        uptime: health.metrics.uptime.toString(),
        databaseOk: health.services.database.toString(),
        redisOk: health.services.redis.toString(),
        rssOk: health.services.rss.toString(),
        websocketOk: health.services.websocket.toString(),
        errors: JSON.stringify(health.errors)
      };

      await redis.hSet(`health:${health.nodeId}`, healthData);
      await redis.expire(`health:${health.nodeId}`, 60); // 1 minute TTL
    } catch (error) {
      logger.error('Failed to store health metrics in Redis:', error);
    }
  }

  /**
   * Handle unhealthy node - trigger failover if needed
   */
  private async handleUnhealthyNode(nodeId: string, errors: string[]): Promise<void> {
    logger.warn(`🚨 Node ${nodeId} is unhealthy: ${errors.join(', ')}`);
    
    try {
      // Get other healthy nodes
      const healthyNodes = await this.getHealthyNodes();
      
      if (healthyNodes.length === 0) {
        logger.error('🚨 No healthy nodes available for failover!');
        return;
      }
      
      // Trigger failover for critical services
      await this.performFailover(nodeId, healthyNodes[0], errors);
    } catch (error) {
      logger.error('Failover handling failed:', error);
    }
  }

  /**
   * Get list of healthy nodes from cluster
   */
  private async getHealthyNodes(): Promise<string[]> {
    try {
      const redis = await getRedisClient();
      if (!redis) return [];

      const healthKeys = await redis.keys('health:*');
      const healthyNodes: string[] = [];

      for (const key of healthKeys) {
        const health = await redis.hGetAll(key);
        if (health.status === 'healthy' || health.status === 'degraded') {
          healthyNodes.push(health.nodeId);
        }
      }

      return healthyNodes.filter(node => node !== distributedScheduler.getNodeId());
    } catch (error) {
      logger.error('Failed to get healthy nodes:', error);
      return [];
    }
  }

  /**
   * Perform failover to healthy node
   */
  private async performFailover(
    unhealthyNode: string, 
    targetNode: string, 
    errors: string[]
  ): Promise<void> {
    const failoverEvent: FailoverEvent = {
      timestamp: new Date(),
      fromNode: unhealthyNode,
      toNode: targetNode,
      reason: errors.join('; '),
      services: []
    };

    try {
      // Release all locks held by unhealthy node
      const redis = await getRedisClient();
      if (redis) {
        const lockKeys = await redis.keys('lock:rss:*');
        
        for (const key of lockKeys) {
          const owner = await redis.get(key);
          if (owner === unhealthyNode) {
            await redis.del(key);
            failoverEvent.services.push(`RSS lock: ${key}`);
            logger.info(`🔄 Released lock ${key} from unhealthy node ${unhealthyNode}`);
          }
        }
      }

      // Store failover event
      this.failoverHistory.push(failoverEvent);
      
      // Keep only last 50 failover events
      if (this.failoverHistory.length > 50) {
        this.failoverHistory = this.failoverHistory.slice(-50);
      }

      // Store in Redis for cluster visibility
      if (redis) {
        await redis.lPush('cluster:failovers', JSON.stringify(failoverEvent));
        await redis.lTrim('cluster:failovers', 0, 49); // Keep last 50
      }

      logger.info(`🔄 Failover completed: ${unhealthyNode} → ${targetNode}`);
    } catch (error) {
      logger.error('Failover execution failed:', error);
    }
  }

  /**
   * Get cluster health summary
   */
  async getClusterHealth(): Promise<{
    totalNodes: number;
    healthyNodes: number;
    degradedNodes: number;
    unhealthyNodes: number;
    nodes: HealthMetrics[];
    lastFailover?: FailoverEvent;
  }> {
    try {
      const redis = await getRedisClient();
      const nodes: HealthMetrics[] = [];
      
      if (redis) {
        const healthKeys = await redis.keys('health:*');
        
        for (const key of healthKeys) {
          const healthData = await redis.hGetAll(key);
          if (healthData.nodeId) {
            nodes.push({
              nodeId: healthData.nodeId,
              status: healthData.status as HealthMetrics['status'],
              lastCheck: new Date(healthData.lastCheck),
              responseTime: parseInt(healthData.responseTime) || 0,
              metrics: {
                cpuUsage: parseFloat(healthData.cpuUsage) || 0,
                memoryUsage: parseFloat(healthData.memoryUsage) || 0,
                memoryTotal: parseFloat(healthData.memoryTotal) || 0,
                activeConnections: parseInt(healthData.activeConnections) || 0,
                uptime: parseFloat(healthData.uptime) || 0,
                loadAverage: [0, 0, 0] // Not stored in Redis
              },
              services: {
                database: healthData.databaseOk === 'true',
                redis: healthData.redisOk === 'true',
                rss: healthData.rssOk === 'true',
                websocket: healthData.websocketOk === 'true'
              },
              errors: JSON.parse(healthData.errors || '[]')
            });
          }
        }
      }

      // Add local node if not in Redis
      const localNodeId = distributedScheduler.getNodeId();
      if (!nodes.find(n => n.nodeId === localNodeId)) {
        const localHealth = this.healthChecks.get(localNodeId);
        if (localHealth) {
          nodes.push(localHealth);
        }
      }

      const healthyCount = nodes.filter(n => n.status === 'healthy').length;
      const degradedCount = nodes.filter(n => n.status === 'degraded').length;
      const unhealthyCount = nodes.filter(n => n.status === 'unhealthy').length;

      return {
        totalNodes: nodes.length,
        healthyNodes: healthyCount,
        degradedNodes: degradedCount,
        unhealthyNodes: unhealthyCount,
        nodes,
        lastFailover: this.failoverHistory[this.failoverHistory.length - 1]
      };
    } catch (error) {
      logger.error('Failed to get cluster health:', error);
      return {
        totalNodes: 0,
        healthyNodes: 0,
        degradedNodes: 0,
        unhealthyNodes: 0,
        nodes: [],
      };
    }
  }

  /**
   * Get failover history
   */
  getFailoverHistory(): FailoverEvent[] {
    return [...this.failoverHistory];
  }

  /**
   * Force failover for testing
   */
  async forceFailover(reason: string = 'Manual failover'): Promise<boolean> {
    const healthyNodes = await this.getHealthyNodes();
    
    if (healthyNodes.length === 0) {
      logger.error('No healthy nodes available for forced failover');
      return false;
    }

    await this.performFailover(
      distributedScheduler.getNodeId(),
      healthyNodes[0],
      [reason]
    );

    return true;
  }
}

export const healthCheckManager = new HealthCheckManager();