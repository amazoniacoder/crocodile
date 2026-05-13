import { WebSocket } from 'ws';
import { getRedisClient } from '../../db/redis';
import { logger } from '../../utils/logger';
import { distributedScheduler } from './DistributedScheduler';

interface WebSocketConnection {
  id: string;
  nodeId: string;
  connectedAt: Date;
  lastPing: Date;
  clientInfo?: {
    userAgent?: string;
    ip?: string;
  };
}

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
  nodeId?: string;
}

/**
 * Manages WebSocket connections across cluster nodes
 */
export class WebSocketManager {
  private connections = new Map<string, WebSocket>();
  private connectionInfo = new Map<string, WebSocketConnection>();
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT = 60000; // 60 seconds

  constructor() {
    // Clean up stale connections periodically
    setInterval(() => this.cleanupStaleConnections(), this.CONNECTION_TIMEOUT);
  }

  /**
   * Register a new WebSocket connection
   */
  async registerConnection(ws: WebSocket, connectionId: string, clientInfo?: any): Promise<void> {
    const nodeId = distributedScheduler.getNodeId();
    
    this.connections.set(connectionId, ws);
    this.connectionInfo.set(connectionId, {
      id: connectionId,
      nodeId,
      connectedAt: new Date(),
      lastPing: new Date(),
      clientInfo
    });

    // Store connection info in Redis for cluster coordination
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.hSet(`ws:connection:${connectionId}`, {
          nodeId,
          connectedAt: new Date().toISOString(),
          lastPing: new Date().toISOString(),
          clientInfo: JSON.stringify(clientInfo || {})
        });
        await redis.expire(`ws:connection:${connectionId}`, Math.ceil(this.CONNECTION_TIMEOUT / 1000));
      }
    } catch (error) {
      logger.error('Failed to store WebSocket connection in Redis:', error);
    }

    logger.info(`🔌 WebSocket connected: ${connectionId} on node ${nodeId}`);
  }

  /**
   * Unregister a WebSocket connection
   */
  async unregisterConnection(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
    this.connectionInfo.delete(connectionId);

    // Remove from Redis
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.del(`ws:connection:${connectionId}`);
      }
    } catch (error) {
      logger.error('Failed to remove WebSocket connection from Redis:', error);
    }

    logger.info(`🔌 WebSocket disconnected: ${connectionId}`);
  }

  /**
   * Update connection heartbeat
   */
  async updateHeartbeat(connectionId: string): Promise<void> {
    const info = this.connectionInfo.get(connectionId);
    if (info) {
      info.lastPing = new Date();
      
      // Update in Redis
      try {
        const redis = await getRedisClient();
        if (redis) {
          await redis.hSet(`ws:connection:${connectionId}`, {
            lastPing: new Date().toISOString()
          });
          await redis.expire(`ws:connection:${connectionId}`, Math.ceil(this.CONNECTION_TIMEOUT / 1000));
        }
      } catch (error) {
        logger.error('Failed to update WebSocket heartbeat in Redis:', error);
      }
    }
  }

  /**
   * Broadcast message to all connections on this node
   */
  broadcastToLocalConnections(message: WebSocketMessage): number {
    let sentCount = 0;
    
    for (const [connectionId, ws] of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({
            ...message,
            nodeId: distributedScheduler.getNodeId()
          }));
          sentCount++;
        } catch (error) {
          logger.error(`Failed to send message to connection ${connectionId}:`, error);
          // Remove failed connection
          this.unregisterConnection(connectionId);
        }
      }
    }
    
    return sentCount;
  }

  /**
   * Broadcast message to all connections across the cluster
   */
  async broadcastToCluster(message: WebSocketMessage): Promise<void> {
    // First, broadcast to local connections
    const localCount = this.broadcastToLocalConnections(message);
    
    // Then, publish to Redis for other nodes to pick up
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.publish('ws:broadcast', JSON.stringify({
          ...message,
          sourceNodeId: distributedScheduler.getNodeId(),
          timestamp: new Date().toISOString()
        }));
        
        logger.debug(`📡 Broadcasted to ${localCount} local connections and published to cluster`);
      } else {
        logger.debug(`📡 Broadcasted to ${localCount} local connections (Redis unavailable)`);
      }
    } catch (error) {
      logger.error('Failed to publish WebSocket message to cluster:', error);
    }
  }

  /**
   * Alias for broadcastToCluster for backward compatibility
   */
  async broadcastToAll(message: WebSocketMessage): Promise<void> {
    return this.broadcastToCluster(message);
  }

  /**
   * Subscribe to cluster WebSocket broadcasts
   */
  async subscribeToClusterBroadcasts(): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        logger.warn('Redis unavailable - WebSocket cluster broadcasting disabled');
        return;
      }

      // Create subscriber client
      const subscriber = redis.duplicate();
      await subscriber.connect();
      
      await subscriber.subscribe('ws:broadcast', (message: string) => {
        try {
          const data = JSON.parse(message);
          
          // Don't rebroadcast messages from this node
          if (data.sourceNodeId === distributedScheduler.getNodeId()) {
            return;
          }
          
          // Broadcast to local connections
          const localCount = this.broadcastToLocalConnections(data);
          logger.debug(`📡 Received cluster broadcast, sent to ${localCount} local connections`);
        } catch (error) {
          logger.error('Error processing cluster WebSocket broadcast:', error);
        }
      });
      
      logger.info('🔔 Subscribed to WebSocket cluster broadcasts');
    } catch (error) {
      logger.error('Failed to subscribe to WebSocket cluster broadcasts:', error);
    }
  }

  /**
   * Get connection statistics for this node
   */
  getLocalConnectionStats(): {
    totalConnections: number;
    activeConnections: number;
    nodeId: string;
  } {
    let activeCount = 0;
    
    for (const ws of this.connections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        activeCount++;
      }
    }
    
    return {
      totalConnections: this.connections.size,
      activeConnections: activeCount,
      nodeId: distributedScheduler.getNodeId()
    };
  }

  /**
   * Get connection statistics across the cluster
   */
  async getClusterConnectionStats(): Promise<{
    totalNodes: number;
    totalConnections: number;
    nodeStats: Array<{
      nodeId: string;
      connections: number;
      lastSeen: Date;
    }>;
  }> {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        const local = this.getLocalConnectionStats();
        return {
          totalNodes: 1,
          totalConnections: local.activeConnections,
          nodeStats: [{
            nodeId: local.nodeId,
            connections: local.activeConnections,
            lastSeen: new Date()
          }]
        };
      }

      // Get all connection keys
      const connectionKeys = await redis.keys('ws:connection:*');
      const nodeConnections = new Map<string, number>();
      const nodeLastSeen = new Map<string, Date>();
      
      for (const key of connectionKeys) {
        const info = await redis.hGetAll(key);
        if (info.nodeId) {
          nodeConnections.set(info.nodeId, (nodeConnections.get(info.nodeId) || 0) + 1);
          const lastPing = new Date(info.lastPing || info.connectedAt);
          if (!nodeLastSeen.has(info.nodeId) || lastPing > nodeLastSeen.get(info.nodeId)!) {
            nodeLastSeen.set(info.nodeId, lastPing);
          }
        }
      }
      
      const nodeStats = Array.from(nodeConnections.entries()).map(([nodeId, connections]) => ({
        nodeId,
        connections,
        lastSeen: nodeLastSeen.get(nodeId) || new Date()
      }));
      
      return {
        totalNodes: nodeStats.length,
        totalConnections: Array.from(nodeConnections.values()).reduce((sum, count) => sum + count, 0),
        nodeStats
      };
    } catch (error) {
      logger.error('Failed to get cluster WebSocket stats:', error);
      const local = this.getLocalConnectionStats();
      return {
        totalNodes: 1,
        totalConnections: local.activeConnections,
        nodeStats: [{
          nodeId: local.nodeId,
          connections: local.activeConnections,
          lastSeen: new Date()
        }]
      };
    }
  }

  /**
   * Clean up stale connections
   */
  private async cleanupStaleConnections(): Promise<void> {
    const now = Date.now();
    const staleConnections: string[] = [];
    
    for (const [connectionId, info] of this.connectionInfo) {
      const ws = this.connections.get(connectionId);
      
      // Remove if WebSocket is closed or connection is stale
      if (!ws || ws.readyState !== WebSocket.OPEN || 
          (now - info.lastPing.getTime()) > this.CONNECTION_TIMEOUT) {
        staleConnections.push(connectionId);
      }
    }
    
    for (const connectionId of staleConnections) {
      await this.unregisterConnection(connectionId);
    }
    
    if (staleConnections.length > 0) {
      logger.debug(`🧹 Cleaned up ${staleConnections.length} stale WebSocket connections`);
    }
  }
}

export const webSocketManager = new WebSocketManager();