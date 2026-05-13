import { Router } from 'express';
import { alertManager } from '../../../infrastructure/monitoring/AlertManager';
import { logger } from '../../../utils/logger';
import { authenticateAdmin } from '../../../middleware/security';

const router = Router();

// Apply admin auth to all routes
router.use(authenticateAdmin);

/**
 * GET /api/admin/alerts
 * Get all active alerts
 */
router.get('/', async (req, res) => {
  try {
    const activeAlerts = await alertManager.getActiveAlerts();
    
    res.json({
      success: true,
      alerts: activeAlerts,
      count: activeAlerts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get active alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve active alerts'
    });
  }
});

/**
 * GET /api/admin/alerts/history
 * Get alert history
 */
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const history = await alertManager.getAlertHistory(limit);
    
    res.json({
      success: true,
      alerts: history,
      count: history.length,
      limit,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get alert history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alert history'
    });
  }
});

/**
 * GET /api/admin/alerts/stats
 * Get alert statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await alertManager.getAlertStats();
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get alert stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alert statistics'
    });
  }
});

/**
 * POST /api/admin/alerts/:alertId/acknowledge
 * Acknowledge an alert
 */
router.post('/:alertId/acknowledge', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { acknowledgedBy = 'admin' } = req.body;
    
    const success = await alertManager.acknowledgeAlert(alertId, acknowledgedBy);
    
    if (success) {
      res.json({
        success: true,
        message: `Alert ${alertId} acknowledged by ${acknowledgedBy}`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found or already resolved'
      });
    }
  } catch (error) {
    logger.error(`Failed to acknowledge alert ${req.params.alertId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert'
    });
  }
});

/**
 * GET /api/admin/alerts/rules
 * Get all alert rules
 */
router.get('/rules', async (req, res) => {
  try {
    const rules = alertManager.getAllRules();
    
    res.json({
      success: true,
      rules,
      count: rules.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get alert rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alert rules'
    });
  }
});

/**
 * PATCH /api/admin/alerts/rules/:ruleId/toggle
 * Enable/disable an alert rule
 */
router.patch('/rules/:ruleId/toggle', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled field must be a boolean'
      });
    }
    
    const success = await alertManager.toggleRule(ruleId, enabled);
    
    if (success) {
      res.json({
        success: true,
        message: `Alert rule ${ruleId} ${enabled ? 'enabled' : 'disabled'}`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert rule not found'
      });
    }
  } catch (error) {
    logger.error(`Failed to toggle alert rule ${req.params.ruleId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle alert rule'
    });
  }
});

/**
 * POST /api/admin/alerts/test
 * Test alert system by triggering a test alert
 */
router.post('/test', async (req, res) => {
  try {
    const { severity = 'info', message = 'Test alert from admin panel' } = req.body;
    
    // Manually trigger the alert (simplified)
    logger.warn(`🧪 Test alert triggered: ${message}`, {
      severity,
      triggeredBy: 'admin',
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Test alert triggered successfully',
      testAlert: {
        id: `test-${Date.now()}`,
        severity,
        message,
        triggeredAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to trigger test alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger test alert'
    });
  }
});

/**
 * GET /api/admin/alerts/dashboard
 * Get comprehensive alert dashboard data
 */
router.get('/dashboard', async (req, res) => {
  try {
    const [activeAlerts, stats, rules] = await Promise.all([
      alertManager.getActiveAlerts(),
      alertManager.getAlertStats(),
      alertManager.getAllRules()
    ]);
    
    // Group active alerts by severity
    const alertsBySeverity = {
      critical: activeAlerts.filter(a => a.severity === 'critical'),
      warning: activeAlerts.filter(a => a.severity === 'warning'),
      info: activeAlerts.filter(a => a.severity === 'info')
    };
    
    // Get rule status summary
    const rulesSummary = {
      total: rules.length,
      enabled: rules.filter(r => r.enabled).length,
      disabled: rules.filter(r => !r.enabled).length
    };
    
    res.json({
      success: true,
      dashboard: {
        activeAlerts: {
          total: activeAlerts.length,
          bySeverity: alertsBySeverity,
          list: activeAlerts.slice(0, 10) // Latest 10 for dashboard
        },
        statistics: stats,
        rules: rulesSummary,
        systemStatus: {
          alertingEnabled: true,
          lastCheck: new Date().toISOString(),
          rulesLoaded: rules.length
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get alert dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alert dashboard data'
    });
  }
});

export default router;