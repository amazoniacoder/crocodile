import { distributedScheduler } from './DistributedScheduler';
import { logger } from '../../utils/logger';

interface LoadBalancingStrategy {
  selectNode(nodes: Array<{ nodeId: string; cpuUsage: number; memoryUsage: number }>): string | null;
}

/**
 * Round-robin load balancing
 */
class RoundRobinStrategy implements LoadBalancingStrategy {
  private currentIndex = 0;

  selectNode(nodes: Array<{ nodeId: string }>): string | null {
    if (nodes.length === 0) return null;
    
    const selected = nodes[this.currentIndex % nodes.length];
    this.currentIndex = (this.currentIndex + 1) % nodes.length;
    
    return selected.nodeId;
  }
}

/**
 * Least loaded strategy - selects node with lowest CPU + memory usage
 */
class LeastLoadedStrategy implements LoadBalancingStrategy {
  selectNode(nodes: Array<{ nodeId: string; cpuUsage: number; memoryUsage: number }>): string | null {
    if (nodes.length === 0) return null;
    
    let bestNode = nodes[0];
    let bestScore = this.calculateLoadScore(bestNode);
    
    for (let i = 1; i < nodes.length; i++) {
      const score = this.calculateLoadScore(nodes[i]);
      if (score < bestScore) {
        bestScore = score;
        bestNode = nodes[i];
      }
    }
    
    return bestNode.nodeId;
  }
  
  private calculateLoadScore(node: { cpuUsage: number; memoryUsage: number }): number {
    // Weighted score: CPU usage has more weight than memory
    return (node.cpuUsage * 0.7) + (node.memoryUsage / 1000 * 0.3);
  }
}

/**
 * Load balancer for distributing RSS collection tasks across cluster nodes
 */
export class LoadBalancer {
  private strategy: LoadBalancingStrategy;
  
  constructor(strategy: 'round-robin' | 'least-loaded' = 'least-loaded') {
    this.strategy = strategy === 'round-robin' 
      ? new RoundRobinStrategy() 
      : new LeastLoadedStrategy();
  }

  /**
   * Determine if current node should handle RSS collection
   */
  async shouldHandleCollection(taskType: 'fast' | 'slow'): Promise<boolean> {
    try {
      // If Redis is not available, fallback to single-node mode
      const isRedisAvailable = await distributedScheduler.isRedisAvailable();
      if (!isRedisAvailable) {
        logger.warn('🔄 Redis unavailable, running in single-node mode');
        return true;
      }

      // Try to acquire distributed lock for this task type
      const lockAcquired = taskType === 'fast' 
        ? await distributedScheduler.shouldHandleFastSources()
        : await distributedScheduler.shouldHandleSlowSources();

      if (lockAcquired) {
        logger.info(`🎯 Node ${distributedScheduler.getNodeId()} handling ${taskType} sources`);
        return true;
      }

      logger.debug(`⏭️ Node ${distributedScheduler.getNodeId()} skipping ${taskType} sources (handled by another node)`);
      return false;
    } catch (error) {
      logger.error(`Error in load balancing for ${taskType} sources:`, error);
      // Fallback to handling the task if there's an error
      return true;
    }
  }

  /**
   * Get the best node for handling a specific task
   */
  async getBestNodeForTask(): Promise<string | null> {
    try {
      const activeNodes = await distributedScheduler.getActiveNodes();
      
      if (activeNodes.length === 0) {
        return distributedScheduler.getNodeId(); // Current node is the only one
      }
      
      return this.strategy.selectNode(activeNodes);
    } catch (error) {
      logger.error('Error selecting best node:', error);
      return distributedScheduler.getNodeId();
    }
  }

  /**
   * Get cluster health information
   */
  async getClusterHealth(): Promise<{
    totalNodes: number;
    activeNodes: number;
    currentNode: string;
    isRedisAvailable: boolean;
    nodes: Array<{
      nodeId: string;
      cpuUsage: number;
      memoryUsage: number;
      activeConnections: number;
      lastHeartbeat: Date;
      isCurrentNode: boolean;
    }>;
  }> {
    const currentNodeId = distributedScheduler.getNodeId();
    const isRedisAvailable = await distributedScheduler.isRedisAvailable();
    
    if (!isRedisAvailable) {
      return {
        totalNodes: 1,
        activeNodes: 1,
        currentNode: currentNodeId,
        isRedisAvailable: false,
        nodes: [{
          nodeId: currentNodeId,
          cpuUsage: 0,
          memoryUsage: process.memoryUsage().rss / 1024 / 1024,
          activeConnections: 0,
          lastHeartbeat: new Date(),
          isCurrentNode: true
        }]
      };
    }

    try {
      const activeNodes = await distributedScheduler.getActiveNodes();
      
      return {
        totalNodes: activeNodes.length,
        activeNodes: activeNodes.length,
        currentNode: currentNodeId,
        isRedisAvailable: true,
        nodes: activeNodes.map(node => ({
          ...node,
          isCurrentNode: node.nodeId === currentNodeId
        }))
      };
    } catch (error) {
      logger.error('Error getting cluster health:', error);
      return {
        totalNodes: 0,
        activeNodes: 0,
        currentNode: currentNodeId,
        isRedisAvailable: false,
        nodes: []
      };
    }
  }

  /**
   * Release locks when collection cycle completes
   */
  async releaseCollectionLock(taskType: 'fast' | 'slow'): Promise<void> {
    try {
      const lockReleased = await distributedScheduler.releaseLock(`${taskType}-sources`);
      if (lockReleased) {
        logger.debug(`🔓 Released ${taskType} sources lock`);
      }
    } catch (error) {
      logger.error(`Error releasing ${taskType} sources lock:`, error);
    }
  }
}

export const loadBalancer = new LoadBalancer();