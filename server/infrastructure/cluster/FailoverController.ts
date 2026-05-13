import { healthCheckManager } from './HealthCheckManager';
import { distributedScheduler } from './DistributedScheduler';
import { webSocketManager } from './WebSocketManager';
import { getRedisClient } from '../../db/redis';
import { logger } from '../../utils/logger';

interface FailoverPolicy {
  enabled: boolean;
  maxFailoversPerHour: number;
  cooldownMinutes: number;
  requiredHealthyNodes: number;
  autoRecovery: boolean;
}

interface FailoverAction {
  type: 'release_locks' | 'transfer_connections' | 'restart_services' | 'notify_admin';
  target: string;
  metadata?: any;
}

export class FailoverController {
  private failoverCount = 0;
  private lastFailoverTime: Date | null = null;
  private isFailoverInProgress = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  private policy: FailoverPolicy = {
    enabled: true,
    maxFailoversPerHour: 3,
    cooldownMinutes: 5,
    requiredHealthyNodes: 1,
    autoRecovery: true
  };

  constructor() {
    this.startMonitoring();
    
    // Reset failover count every hour
    setInterval(() => {
      this.failoverCount = 0;
    }, 60 * 60 * 1000);
  }

  /**
   * Start monitoring cluster for failover conditions
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.checkFailoverConditions();
    }, 30000); // Check every 30 seconds
    
    logger.info('🔄 Failover controller started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    logger.info('🔄 Failover controller stopped');
  }

  /**
   * Check if failover is needed
   */
  private async checkFailoverConditions(): Promise<void> {
    if (!this.policy.enabled || this.isFailoverInProgress) {
      return;
    }

    try {
      const clusterHealth = await healthCheckManager.getClusterHealth();
      
      // Check if we have enough healthy nodes
      if (clusterHealth.healthyNodes < this.policy.requiredHealthyNodes) {
        logger.warn(`🚨 Insufficient healthy nodes: ${clusterHealth.healthyNodes}/${this.policy.requiredHealthyNodes}`);
        return;
      }

      // Check for nodes that need failover
      const unhealthyNodes = clusterHealth.nodes.filter(n => n.status === 'unhealthy');
      
      for (const node of unhealthyNodes) {
        if (await this.shouldTriggerFailover(node.nodeId)) {
          await this.executeFailover(node.nodeId, clusterHealth.nodes);
        }
      }
    } catch (error) {
      logger.error('Error checking failover conditions:', error);
    }
  }

  /**
   * Determine if failover should be triggered for a node
   */
  private async shouldTriggerFailover(nodeId: string): Promise<boolean> {
    // Check cooldown period
    if (this.lastFailoverTime) {
      const cooldownMs = this.policy.cooldownMinutes * 60 * 1000;
      if (Date.now() - this.lastFailoverTime.getTime() < cooldownMs) {
        logger.debug(`Failover in cooldown for node ${nodeId}`);
        return false;
      }
    }

    // Check failover rate limit
    if (this.failoverCount >= this.policy.maxFailoversPerHour) {
      logger.warn(`Failover rate limit exceeded: ${this.failoverCount}/${this.policy.maxFailoversPerHour}`);
      return false;
    }

    // Check if node is holding critical resources
    const isHoldingResources = await this.checkCriticalResources(nodeId);
    
    return isHoldingResources;
  }

  /**
   * Check if node is holding critical resources that need failover
   */
  private async checkCriticalResources(nodeId: string): Promise<boolean> {
    try {
      const redis = await getRedisClient();
      if (!redis) return false;

      // Check for RSS collection locks
      const lockKeys = await redis.keys('lock:rss:*');
      
      for (const key of lockKeys) {
        const owner = await redis.get(key);
        if (owner === nodeId) {
          logger.info(`Node ${nodeId} holds critical lock: ${key}`);
          return true;
        }
      }

      // Check for active WebSocket connections
      const wsStats = await webSocketManager.getClusterConnectionStats();
      const nodeStats = wsStats.nodeStats.find(n => n.nodeId === nodeId);
      
      if (nodeStats && nodeStats.connections > 0) {
        logger.info(`Node ${nodeId} has ${nodeStats.connections} active WebSocket connections`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error checking critical resources for node ${nodeId}:`, error);
      return false;
    }
  }

  /**
   * Execute failover for unhealthy node
   */
  private async executeFailover(unhealthyNodeId: string, allNodes: any[]): Promise<void> {
    if (this.isFailoverInProgress) {
      logger.warn('Failover already in progress, skipping');
      return;
    }

    this.isFailoverInProgress = true;
    this.failoverCount++;
    this.lastFailoverTime = new Date();

    logger.warn(`🔄 Starting failover for unhealthy node: ${unhealthyNodeId}`);

    try {
      // Find best target node for failover
      const targetNode = this.selectTargetNode(allNodes, unhealthyNodeId);
      
      if (!targetNode) {
        logger.error('No suitable target node found for failover');
        return;
      }

      // Execute failover actions
      const actions = await this.planFailoverActions(unhealthyNodeId, targetNode);
      
      for (const action of actions) {
        await this.executeFailoverAction(action);
      }

      // Record failover event
      await this.recordFailoverEvent(unhealthyNodeId, targetNode, actions);
      
      // Notify administrators
      await this.notifyFailover(unhealthyNodeId, targetNode, actions);

      logger.info(`✅ Failover completed: ${unhealthyNodeId} → ${targetNode}`);
    } catch (error) {
      logger.error('Failover execution failed:', error);
    } finally {
      this.isFailoverInProgress = false;
    }
  }

  /**
   * Select best target node for failover
   */
  private selectTargetNode(nodes: any[], excludeNodeId: string): string | null {
    const candidates = nodes.filter(n => 
      n.nodeId !== excludeNodeId && 
      (n.status === 'healthy' || n.status === 'degraded')
    );

    if (candidates.length === 0) {
      return null;
    }

    // Sort by health score (lower is better)
    candidates.sort((a, b) => {
      const scoreA = this.calculateHealthScore(a);
      const scoreB = this.calculateHealthScore(b);
      return scoreA - scoreB;
    });

    return candidates[0].nodeId;
  }

  /**
   * Calculate health score for node selection
   */
  private calculateHealthScore(node: any): number {
    let score = 0;
    
    // Prefer healthy over degraded
    if (node.status === 'degraded') score += 10;
    
    // Consider resource usage
    score += node.metrics.cpuUsage * 0.1;
    score += (node.metrics.memoryUsage / node.metrics.memoryTotal) * 100 * 0.1;
    score += node.metrics.activeConnections * 0.01;
    
    return score;
  }

  /**
   * Plan failover actions
   */
  private async planFailoverActions(unhealthyNode: string, targetNode: string): Promise<FailoverAction[]> {
    const actions: FailoverAction[] = [];

    // Always release locks
    actions.push({
      type: 'release_locks',
      target: unhealthyNode,
      metadata: { reason: 'Node unhealthy' }
    });

    // Transfer WebSocket connections if any
    const wsStats = await webSocketManager.getClusterConnectionStats();
    const nodeConnections = wsStats.nodeStats.find(n => n.nodeId === unhealthyNode);
    
    if (nodeConnections && nodeConnections.connections > 0) {
      actions.push({
        type: 'transfer_connections',
        target: targetNode,
        metadata: { 
          fromNode: unhealthyNode,
          connectionCount: nodeConnections.connections 
        }
      });
    }

    // Notify administrators
    actions.push({
      type: 'notify_admin',
      target: 'admin',
      metadata: {
        unhealthyNode,
        targetNode,
        timestamp: new Date().toISOString()
      }
    });

    return actions;
  }

  /**
   * Execute individual failover action
   */
  private async executeFailoverAction(action: FailoverAction): Promise<void> {
    try {
      switch (action.type) {
        case 'release_locks':
          await this.releaseLocks(action.target);
          break;
          
        case 'transfer_connections':
          await this.transferConnections(action.metadata.fromNode, action.target);
          break;
          
        case 'notify_admin':
          await this.sendAdminNotification(action.metadata);
          break;
          
        default:
          logger.warn(`Unknown failover action type: ${action.type}`);
      }
    } catch (error) {
      logger.error(`Failed to execute failover action ${action.type}:`, error);
    }
  }

  /**
   * Release all locks held by a node
   */
  private async releaseLocks(nodeId: string): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (!redis) return;

      const lockKeys = await redis.keys('lock:rss:*');
      let releasedCount = 0;

      for (const key of lockKeys) {
        const owner = await redis.get(key);
        if (owner === nodeId) {
          await redis.del(key);
          releasedCount++;
          logger.info(`🔓 Released lock: ${key}`);
        }
      }

      logger.info(`Released ${releasedCount} locks from node ${nodeId}`);
    } catch (error) {
      logger.error(`Failed to release locks for node ${nodeId}:`, error);
    }
  }

  /**
   * Handle WebSocket connection transfer
   */
  private async transferConnections(fromNode: string, toNode: string): Promise<void> {
    // WebSocket connections can't be transferred directly
    // Instead, we notify clients to reconnect
    try {
      await webSocketManager.broadcastToCluster({
        type: 'node_failover',
        data: {
          fromNode,
          toNode,
          action: 'reconnect_required',
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });

      logger.info(`Notified clients to reconnect from ${fromNode} to ${toNode}`);
    } catch (error) {
      logger.error(`Failed to notify connection transfer:`, error);
    }
  }

  /**
   * Send admin notification
   */
  private async sendAdminNotification(metadata: any): Promise<void> {
    // Store notification in Redis for admin dashboard
    try {
      const redis = await getRedisClient();
      if (!redis) return;

      const notification = {
        type: 'failover',
        severity: 'warning',
        message: `Failover executed: ${metadata.unhealthyNode} → ${metadata.targetNode}`,
        timestamp: metadata.timestamp,
        metadata
      };

      await redis.lPush('admin:notifications', JSON.stringify(notification));
      await redis.lTrim('admin:notifications', 0, 99); // Keep last 100

      logger.info('📧 Admin notification sent');
    } catch (error) {
      logger.error('Failed to send admin notification:', error);
    }
  }

  /**
   * Record failover event
   */
  private async recordFailoverEvent(
    unhealthyNode: string, 
    targetNode: string, 
    actions: FailoverAction[]
  ): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (!redis) return;

      const event = {
        timestamp: new Date().toISOString(),
        fromNode: unhealthyNode,
        toNode: targetNode,
        actions: actions.map(a => a.type),
        triggeredBy: 'automatic',
        nodeId: distributedScheduler.getNodeId()
      };

      await redis.lPush('cluster:failover_events', JSON.stringify(event));
      await redis.lTrim('cluster:failover_events', 0, 49); // Keep last 50

      logger.info('📝 Failover event recorded');
    } catch (error) {
      logger.error('Failed to record failover event:', error);
    }
  }

  /**
   * Notify about failover completion
   */
  private async notifyFailover(
    unhealthyNode: string, 
    targetNode: string, 
    actions: FailoverAction[]
  ): Promise<void> {
    // Broadcast failover completion to cluster
    await webSocketManager.broadcastToCluster({
      type: 'cluster_failover_completed',
      data: {
        fromNode: unhealthyNode,
        toNode: targetNode,
        actions: actions.map(a => a.type),
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Update failover policy
   */
  updatePolicy(newPolicy: Partial<FailoverPolicy>): void {
    this.policy = { ...this.policy, ...newPolicy };
    logger.info('Failover policy updated:', this.policy);
  }

  /**
   * Get current failover status
   */
  getStatus(): {
    enabled: boolean;
    inProgress: boolean;
    failoverCount: number;
    lastFailover: Date | null;
    policy: FailoverPolicy;
  } {
    return {
      enabled: this.policy.enabled,
      inProgress: this.isFailoverInProgress,
      failoverCount: this.failoverCount,
      lastFailover: this.lastFailoverTime,
      policy: this.policy
    };
  }

  /**
   * Manual failover trigger
   */
  async triggerManualFailover(nodeId: string, reason: string): Promise<boolean> {
    if (this.isFailoverInProgress) {
      return false;
    }

    try {
      const clusterHealth = await healthCheckManager.getClusterHealth();
      const targetNode = this.selectTargetNode(clusterHealth.nodes, nodeId);
      
      if (!targetNode) {
        logger.error('No suitable target node for manual failover');
        return false;
      }

      await this.executeFailover(nodeId, clusterHealth.nodes);
      return true;
    } catch (error) {
      logger.error('Manual failover failed:', error);
      return false;
    }
  }
}

export const failoverController = new FailoverController();