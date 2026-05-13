import { Router } from 'express';
import { loadBalancer } from '../../../infrastructure/cluster/LoadBalancer';
import { logger } from '../../../utils/logger';
import { authenticateAdmin } from '../../../middleware/security';
import clusterTestsRouter from './tests';

const router = Router();

// Apply admin auth to all routes
router.use(authenticateAdmin);

// Mount cluster tests router
router.use('/', clusterTestsRouter);

/**
 * GET /api/admin/cluster/health
 * Get cluster health and node information
 */
router.get('/health', async (req, res) => {
  try {
    const clusterHealth = await loadBalancer.getClusterHealth();
    
    res.json({
      success: true,
      cluster: clusterHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get cluster health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cluster health'
    });
  }
});

/**
 * GET /api/admin/cluster/nodes
 * Get detailed information about all nodes
 */
router.get('/nodes', async (req, res) => {
  try {
    const clusterHealth = await loadBalancer.getClusterHealth();
    
    const nodesWithDetails = clusterHealth.nodes.map(node => ({
      ...node,
      uptime: Date.now() - node.lastHeartbeat.getTime(),
      status: Date.now() - node.lastHeartbeat.getTime() < 45000 ? 'healthy' : 'stale',
      loadScore: (node.cpuUsage * 0.7) + (node.memoryUsage / 1000 * 0.3)
    }));
    
    res.json({
      success: true,
      nodes: nodesWithDetails,
      summary: {
        total: clusterHealth.totalNodes,
        active: clusterHealth.activeNodes,
        redisAvailable: clusterHealth.isRedisAvailable
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get cluster nodes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cluster nodes'
    });
  }
});

/**
 * GET /api/admin/cluster/health-detailed
 * Get detailed health information for all nodes
 */
router.get('/health-detailed', async (req, res) => {
  try {
    const { healthCheckManager } = await import('../../../infrastructure/cluster/HealthCheckManager');
    const health = await healthCheckManager.getClusterHealth();
    
    res.json({
      success: true,
      health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get detailed cluster health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve detailed health information'
    });
  }
});

/**
 * GET /api/admin/cluster/failover-status
 * Get failover controller status
 */
router.get('/failover-status', async (req, res) => {
  try {
    const { failoverController } = await import('../../../infrastructure/cluster/FailoverController');
    const status = failoverController.getStatus();
    
    res.json({
      success: true,
      failover: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get failover status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve failover status'
    });
  }
});

/**
 * POST /api/admin/cluster/failover
 * Trigger manual failover
 */
router.post('/failover', async (req, res) => {
  try {
    const { nodeId, reason = 'Manual failover' } = req.body;
    
    if (!nodeId) {
      return res.status(400).json({
        success: false,
        error: 'nodeId is required'
      });
    }
    
    const { failoverController } = await import('../../../infrastructure/cluster/FailoverController');
    const success = await failoverController.triggerManualFailover(nodeId, reason);
    
    if (success) {
      res.json({
        success: true,
        message: `Failover initiated for node ${nodeId}`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failover could not be initiated'
      });
    }
  } catch (error) {
    logger.error('Failed to trigger manual failover:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger failover'
    });
  }
});

/**
 * PATCH /api/admin/cluster/failover-policy
 * Update failover policy
 */
router.patch('/failover-policy', async (req, res) => {
  try {
    const { failoverController } = await import('../../../infrastructure/cluster/FailoverController');
    failoverController.updatePolicy(req.body);
    
    res.json({
      success: true,
      message: 'Failover policy updated',
      policy: failoverController.getStatus().policy,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to update failover policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update failover policy'
    });
  }
});

/**
 * GET /api/admin/cluster/failover-history
 * Get failover history
 */
router.get('/failover-history', async (req, res) => {
  try {
    const { healthCheckManager } = await import('../../../infrastructure/cluster/HealthCheckManager');
    const history = healthCheckManager.getFailoverHistory();
    
    res.json({
      success: true,
      history,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get failover history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve failover history'
    });
  }
});

export default router;