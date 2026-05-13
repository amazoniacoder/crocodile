import { getRedisClient } from '../../db/redis';
import { logger } from '../../utils/logger';

interface NodeHealth {
  nodeId: string;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  lastHeartbeat: Date;
}

interface DistributedLock {
  key: string;
  nodeId: string;
  acquiredAt: Date;
  ttlMs: number;
}

export class DistributedScheduler {
  private nodeId: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly LOCK_TTL_MS = 30000; // 30 seconds
  private readonly HEARTBEAT_INTERVAL_MS = 10000; // 10 seconds
  private readonly NODE_TIMEOUT_MS = 45000; // 45 seconds

  constructor() {
    this.nodeId = `node-${process.pid}-${Date.now()}`;
    this.startHeartbeat();
    
    // Cleanup on process exit
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  /**
   * Acquire distributed lock for RSS collection task
   */
  async acquireLock(taskName: string): Promise<boolean> {
    const lockKey = `lock:rss:${taskName}`;
    
    try {
      const redis = await getRedisClient();
      if (!redis) {
        logger.warn('Redis not available for distributed locking');
        return true; // Fallback to single-node mode
      }
      
      const result = await redis.set(
        lockKey,
        this.nodeId,
        { PX: this.LOCK_TTL_MS, NX: true }
      );
      
      if (result === 'OK') {
        logger.info(`🔒 Lock acquired: ${taskName} by ${this.nodeId}`);
        return true;
      }
      
      // Check who owns the lock
      const owner = await redis.get(lockKey);
      if (owner && owner !== this.nodeId) {
        logger.debug(`🔒 Lock held by: ${owner} for task: ${taskName}`);
      }
      
      return false;
    } catch (error) {
      logger.error(`Failed to acquire lock for ${taskName}:`, error);
      return false;
    }
  }

  /**
   * Release distributed lock
   */
  async releaseLock(taskName: string): Promise<boolean> {
    const lockKey = `lock:rss:${taskName}`;
    
    try {
      const redis = await getRedisClient();
      if (!redis) return false;
      
      // Only release if we own the lock
      const script = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await redis.eval(script, {
        keys: [lockKey],
        arguments: [this.nodeId]
      }) as number;
      
      if (result === 1) {
        logger.info(`🔓 Lock released: ${taskName} by ${this.nodeId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Failed to release lock for ${taskName}:`, error);
      return false;
    }
  }

  /**
   * Check if current node should handle fast sources
   */
  async shouldHandleFastSources(): Promise<boolean> {
    return await this.acquireLock('fast-sources');
  }

  /**
   * Check if current node should handle slow sources
   */
  async shouldHandleSlowSources(): Promise<boolean> {
    return await this.acquireLock('slow-sources');
  }

  /**
   * Get all active nodes in cluster
   */
  async getActiveNodes(): Promise<NodeHealth[]> {
    try {
      const redis = await getRedisClient();
      if (!redis) return [];
      
      const pattern = 'heartbeat:node-*';
      const keys = await redis.keys(pattern);
      const nodes: NodeHealth[] = [];
      
      for (const key of keys) {
        const data = await redis.hGetAll(key);
        if (data && data.nodeId) {
          const lastHeartbeat = new Date(parseInt(data.lastHeartbeat) || 0);
          const isActive = Date.now() - lastHeartbeat.getTime() < this.NODE_TIMEOUT_MS;
          
          if (isActive) {
            nodes.push({
              nodeId: data.nodeId,
              cpuUsage: parseFloat(data.cpuUsage) || 0,
              memoryUsage: parseFloat(data.memoryUsage) || 0,
              activeConnections: parseInt(data.activeConnections) || 0,
              lastHeartbeat
            });
          }
        }
      }
      
      return nodes;
    } catch (error) {
      logger.error('Failed to get active nodes:', error);
      return [];
    }
  }

  /**
   * Start heartbeat to register this node as active
   */
  private startHeartbeat(): void {
    this.sendHeartbeat(); // Send immediately
    
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Update connection count in heartbeat
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (!redis) return;
      
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Get WebSocket connection count
      let activeConnections = 0;
      try {
        const { webSocketManager } = await import('./WebSocketManager');
        const stats = webSocketManager.getLocalConnectionStats();
        activeConnections = stats.activeConnections;
      } catch {
        // WebSocketManager might not be initialized yet
      }
      
      const heartbeatData = {
        nodeId: this.nodeId,
        cpuUsage: ((cpuUsage.user + cpuUsage.system) / 1000000).toString(), // Convert to seconds
        memoryUsage: (memUsage.rss / 1024 / 1024).toString(), // Convert to MB
        activeConnections: activeConnections.toString(),
        lastHeartbeat: Date.now().toString()
      };
      
      await redis.hSet(`heartbeat:${this.nodeId}`, heartbeatData);
      await redis.expire(`heartbeat:${this.nodeId}`, Math.ceil(this.NODE_TIMEOUT_MS / 1000));
      
      logger.debug(`💓 Heartbeat sent by ${this.nodeId} (${activeConnections} WS connections)`);
    } catch (error) {
      logger.error('Failed to send heartbeat:', error);
    }
  }

  /**
   * Cleanup resources on shutdown
   */
  private async cleanup(): Promise<void> {
    logger.info(`🧹 Cleaning up node ${this.nodeId}`);
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    try {
      const redis = await getRedisClient();
      if (!redis) return;
      
      // Remove heartbeat
      await redis.del(`heartbeat:${this.nodeId}`);
      
      // Release any locks held by this node
      const lockPattern = 'lock:rss:*';
      const lockKeys = await redis.keys(lockPattern);
      
      for (const key of lockKeys) {
        const owner = await redis.get(key);
        if (owner === this.nodeId) {
          await redis.del(key);
          logger.info(`🔓 Released lock: ${key}`);
        }
      }
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  /**
   * Get current node ID
   */
  getNodeId(): string {
    return this.nodeId;
  }

  /**
   * Check if Redis is available for distributed coordination
   */
  async isRedisAvailable(): Promise<boolean> {
    try {
      const redis = await getRedisClient();
      if (!redis) return false;
      
      await redis.ping();
      return true;
    } catch {
      return false;
    }
  }
}

export const distributedScheduler = new DistributedScheduler();