import { Router } from 'express';
import { logger } from '../../../utils/logger';
import { authenticateAdmin } from '../../../middleware/security';

interface TestResult {
  name: string;
  status: 'success' | 'warning' | 'error' | 'skipped';
  message: string;
  details?: any;
  duration?: number;
}

interface TestSuite {
  name: string;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
}

const router = Router();

// Apply admin auth to all routes
router.use(authenticateAdmin);

/**
 * POST /api/admin/cluster/test/health
 * Run health check tests
 */
router.post('/test/health', async (req, res) => {
  const startTime = Date.now();
  const results: TestResult[] = [];

  try {
    logger.info('🧪 Starting cluster health tests');

    // Test 1: Check if health monitoring is active
    try {
      const { healthCheckManager } = await import('../../../infrastructure/cluster/HealthCheckManager');
      const clusterHealth = await healthCheckManager.getClusterHealth();
      
      results.push({
        name: 'Health Monitoring Active',
        status: 'success',
        message: `Health monitoring operational with ${clusterHealth.totalNodes} nodes`,
        details: {
          totalNodes: clusterHealth.totalNodes,
          healthyNodes: clusterHealth.healthyNodes,
          degradedNodes: clusterHealth.degradedNodes,
          unhealthyNodes: clusterHealth.unhealthyNodes
        }
      });
    } catch (error) {
      results.push({
        name: 'Health Monitoring Active',
        status: 'error',
        message: `Health monitoring failed: ${error}`,
      });
    }

    // Test 2: Check Redis connectivity for cluster coordination
    try {
      const { getRedisClient } = await import('../../../db/redis');
      const redis = await getRedisClient();
      
      if (redis) {
        await redis.ping();
        results.push({
          name: 'Redis Cluster Coordination',
          status: 'success',
          message: 'Redis available for cluster coordination'
        });
      } else {
        results.push({
          name: 'Redis Cluster Coordination',
          status: 'warning',
          message: 'Redis unavailable - running in single-node mode'
        });
      }
    } catch (error) {
      results.push({
        name: 'Redis Cluster Coordination',
        status: 'error',
        message: `Redis connection failed: ${error}`
      });
    }

    // Test 3: Check database connectivity
    try {
      const { db } = await import('../../../db/db');
      await db.execute('SELECT 1');
      results.push({
        name: 'Database Connectivity',
        status: 'success',
        message: 'Database connection healthy'
      });
    } catch (error) {
      results.push({
        name: 'Database Connectivity',
        status: 'error',
        message: `Database connection failed: ${error}`
      });
    }

    // Test 4: Check WebSocket manager
    try {
      const { webSocketManager } = await import('../../../infrastructure/cluster/WebSocketManager');
      const wsStats = webSocketManager.getLocalConnectionStats();
      
      results.push({
        name: 'WebSocket Service',
        status: 'success',
        message: `WebSocket service active with ${wsStats.activeConnections} connections`,
        details: wsStats
      });
    } catch (error) {
      results.push({
        name: 'WebSocket Service',
        status: 'error',
        message: `WebSocket service failed: ${error}`
      });
    }

    // Test 5: Check RSS collection capability
    try {
      const { collectNewsUseCase } = await import('../../../application/news/CollectNewsUseCase');
      const isRunning = collectNewsUseCase.cycleStartedAt !== null;
      
      results.push({
        name: 'RSS Collection Service',
        status: isRunning ? 'warning' : 'success',
        message: isRunning ? 'RSS collection currently in progress' : 'RSS collection service ready',
        details: {
          isRunning,
          lastCycle: collectNewsUseCase.lastCycleAt,
          nextCycle: collectNewsUseCase.nextCycleAt
        }
      });
    } catch (error) {
      results.push({
        name: 'RSS Collection Service',
        status: 'error',
        message: `RSS collection service failed: ${error}`
      });
    }

    const testSuite: TestSuite = {
      name: 'Cluster Health Tests',
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length,
        warnings: results.filter(r => r.status === 'warning').length,
        skipped: results.filter(r => r.status === 'skipped').length
      }
    };

    const duration = Date.now() - startTime;
    logger.info(`🧪 Health tests completed in ${duration}ms`);

    res.json({
      success: true,
      testSuite,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Health test suite failed:', error);
    res.status(500).json({
      success: false,
      error: 'Health test suite failed',
      duration: Date.now() - startTime
    });
  }
});

/**
 * POST /api/admin/cluster/test/failover
 * Run failover system tests
 */
router.post('/test/failover', async (req, res) => {
  const startTime = Date.now();
  const results: TestResult[] = [];

  try {
    logger.info('🧪 Starting failover system tests');

    // Test 1: Check failover controller status
    try {
      const { failoverController } = await import('../../../infrastructure/cluster/FailoverController');
      const status = failoverController.getStatus();
      
      results.push({
        name: 'Failover Controller Status',
        status: status.enabled ? 'success' : 'warning',
        message: status.enabled ? 'Failover controller is enabled and active' : 'Failover controller is disabled',
        details: {
          enabled: status.enabled,
          inProgress: status.inProgress,
          failoverCount: status.failoverCount,
          policy: status.policy
        }
      });
    } catch (error) {
      results.push({
        name: 'Failover Controller Status',
        status: 'error',
        message: `Failover controller check failed: ${error}`
      });
    }

    // Test 2: Check distributed locks functionality
    try {
      const { distributedScheduler } = await import('../../../infrastructure/cluster/DistributedScheduler');
      const testLockName = `test-lock-${Date.now()}`;
      
      // Try to acquire a test lock
      const lockAcquired = await distributedScheduler.acquireLock(testLockName);
      
      if (lockAcquired) {
        // Try to release the lock
        const lockReleased = await distributedScheduler.releaseLock(testLockName);
        
        results.push({
          name: 'Distributed Locks',
          status: lockReleased ? 'success' : 'warning',
          message: lockReleased ? 'Distributed locks working correctly' : 'Lock acquired but release failed',
          details: { lockAcquired, lockReleased }
        });
      } else {
        results.push({
          name: 'Distributed Locks',
          status: 'warning',
          message: 'Could not acquire test lock - may be normal in single-node mode'
        });
      }
    } catch (error) {
      results.push({
        name: 'Distributed Locks',
        status: 'error',
        message: `Distributed locks test failed: ${error}`
      });
    }

    // Test 3: Check cluster node discovery
    try {
      const { distributedScheduler } = await import('../../../infrastructure/cluster/DistributedScheduler');
      const activeNodes = await distributedScheduler.getActiveNodes();
      
      results.push({
        name: 'Node Discovery',
        status: activeNodes.length > 0 ? 'success' : 'warning',
        message: `Discovered ${activeNodes.length} active nodes in cluster`,
        details: {
          nodeCount: activeNodes.length,
          nodes: activeNodes.map(n => ({
            nodeId: n.nodeId,
            cpuUsage: n.cpuUsage,
            memoryUsage: n.memoryUsage,
            activeConnections: n.activeConnections
          }))
        }
      });
    } catch (error) {
      results.push({
        name: 'Node Discovery',
        status: 'error',
        message: `Node discovery failed: ${error}`
      });
    }

    // Test 4: Check failover history
    try {
      const { healthCheckManager } = await import('../../../infrastructure/cluster/HealthCheckManager');
      const history = healthCheckManager.getFailoverHistory();
      
      results.push({
        name: 'Failover History',
        status: 'success',
        message: `Failover history contains ${history.length} events`,
        details: {
          eventCount: history.length,
          recentEvents: history.slice(-3).map(event => ({
            timestamp: event.timestamp,
            fromNode: event.fromNode,
            toNode: event.toNode,
            reason: event.reason
          }))
        }
      });
    } catch (error) {
      results.push({
        name: 'Failover History',
        status: 'error',
        message: `Failover history check failed: ${error}`
      });
    }

    const testSuite: TestSuite = {
      name: 'Failover System Tests',
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length,
        warnings: results.filter(r => r.status === 'warning').length,
        skipped: results.filter(r => r.status === 'skipped').length
      }
    };

    const duration = Date.now() - startTime;
    logger.info(`🧪 Failover tests completed in ${duration}ms`);

    res.json({
      success: true,
      testSuite,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failover test suite failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failover test suite failed',
      duration: Date.now() - startTime
    });
  }
});

/**
 * POST /api/admin/cluster/test/load-balancing
 * Run load balancing tests
 */
router.post('/test/load-balancing', async (req, res) => {
  const startTime = Date.now();
  const results: TestResult[] = [];

  try {
    logger.info('🧪 Starting load balancing tests');

    // Test 1: Check load balancer configuration
    try {
      const { loadBalancer } = await import('../../../infrastructure/cluster/LoadBalancer');
      const clusterHealth = await loadBalancer.getClusterHealth();
      
      results.push({
        name: 'Load Balancer Configuration',
        status: clusterHealth.isRedisAvailable ? 'success' : 'warning',
        message: clusterHealth.isRedisAvailable 
          ? `Load balancer active with ${clusterHealth.totalNodes} nodes`
          : 'Load balancer in single-node mode (Redis unavailable)',
        details: clusterHealth
      });
    } catch (error) {
      results.push({
        name: 'Load Balancer Configuration',
        status: 'error',
        message: `Load balancer check failed: ${error}`
      });
    }

    // Test 2: Test RSS collection distribution
    try {
      const { loadBalancer } = await import('../../../infrastructure/cluster/LoadBalancer');
      
      // Test fast sources
      const shouldHandleFast = await loadBalancer.shouldHandleCollection('fast');
      const shouldHandleSlow = await loadBalancer.shouldHandleCollection('slow');
      
      results.push({
        name: 'RSS Collection Distribution',
        status: 'success',
        message: `Node handling - Fast: ${shouldHandleFast ? 'Yes' : 'No'}, Slow: ${shouldHandleSlow ? 'Yes' : 'No'}`,
        details: {
          handlingFast: shouldHandleFast,
          handlingSlow: shouldHandleSlow
        }
      });
    } catch (error) {
      results.push({
        name: 'RSS Collection Distribution',
        status: 'error',
        message: `RSS distribution test failed: ${error}`
      });
    }

    // Test 3: WebSocket connection distribution
    try {
      const { webSocketManager } = await import('../../../infrastructure/cluster/WebSocketManager');
      const wsStats = await webSocketManager.getClusterConnectionStats();
      
      results.push({
        name: 'WebSocket Distribution',
        status: 'success',
        message: `WebSocket connections distributed across ${wsStats.totalNodes} nodes`,
        details: {
          totalNodes: wsStats.totalNodes,
          totalConnections: wsStats.totalConnections,
          nodeStats: wsStats.nodeStats
        }
      });
    } catch (error) {
      results.push({
        name: 'WebSocket Distribution',
        status: 'error',
        message: `WebSocket distribution test failed: ${error}`
      });
    }

    // Test 4: Simulate load balancing decision
    try {
      const { loadBalancer } = await import('../../../infrastructure/cluster/LoadBalancer');
      const bestNode = await loadBalancer.getBestNodeForTask();
      
      results.push({
        name: 'Load Balancing Decision',
        status: bestNode ? 'success' : 'warning',
        message: bestNode 
          ? `Best node for task: ${bestNode}`
          : 'No optimal node found - single node mode',
        details: { bestNode }
      });
    } catch (error) {
      results.push({
        name: 'Load Balancing Decision',
        status: 'error',
        message: `Load balancing decision test failed: ${error}`
      });
    }

    const testSuite: TestSuite = {
      name: 'Load Balancing Tests',
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length,
        warnings: results.filter(r => r.status === 'warning').length,
        skipped: results.filter(r => r.status === 'skipped').length
      }
    };

    const duration = Date.now() - startTime;
    logger.info(`🧪 Load balancing tests completed in ${duration}ms`);

    res.json({
      success: true,
      testSuite,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Load balancing test suite failed:', error);
    res.status(500).json({
      success: false,
      error: 'Load balancing test suite failed',
      duration: Date.now() - startTime
    });
  }
});

/**
 * POST /api/admin/cluster/test/comprehensive
 * Run all cluster tests
 */
router.post('/test/comprehensive', async (req, res) => {
  const startTime = Date.now();
  const allResults: TestSuite[] = [];

  try {
    logger.info('🧪 Starting comprehensive cluster tests');

    // Run health tests
    const healthTestsResponse = await fetch(`${req.protocol}://${req.get('host')}/api/admin/cluster/test/health`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.authorization || '',
        'Content-Type': 'application/json'
      }
    });

    if (healthTestsResponse.ok) {
      const healthData = await healthTestsResponse.json();
      allResults.push(healthData.testSuite);
    }

    // Run failover tests
    const failoverTestsResponse = await fetch(`${req.protocol}://${req.get('host')}/api/admin/cluster/test/failover`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.authorization || '',
        'Content-Type': 'application/json'
      }
    });

    if (failoverTestsResponse.ok) {
      const failoverData = await failoverTestsResponse.json();
      allResults.push(failoverData.testSuite);
    }

    // Run load balancing tests
    const loadBalancingTestsResponse = await fetch(`${req.protocol}://${req.get('host')}/api/admin/cluster/test/load-balancing`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.authorization || '',
        'Content-Type': 'application/json'
      }
    });

    if (loadBalancingTestsResponse.ok) {
      const loadBalancingData = await loadBalancingTestsResponse.json();
      allResults.push(loadBalancingData.testSuite);
    }

    // Calculate overall summary
    const overallSummary = {
      total: allResults.reduce((sum, suite) => sum + suite.summary.total, 0),
      passed: allResults.reduce((sum, suite) => sum + suite.summary.passed, 0),
      failed: allResults.reduce((sum, suite) => sum + suite.summary.failed, 0),
      warnings: allResults.reduce((sum, suite) => sum + suite.summary.warnings, 0),
      skipped: allResults.reduce((sum, suite) => sum + suite.summary.skipped, 0)
    };

    const duration = Date.now() - startTime;
    logger.info(`🧪 Comprehensive tests completed in ${duration}ms`);

    res.json({
      success: true,
      testSuites: allResults,
      overallSummary,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Comprehensive test suite failed:', error);
    res.status(500).json({
      success: false,
      error: 'Comprehensive test suite failed',
      duration: Date.now() - startTime
    });
  }
});

export default router;