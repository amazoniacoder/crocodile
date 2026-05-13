import { Router } from 'express';
import { slaMonitor } from '../../../infrastructure/monitoring/SlaMonitor';
import { authenticateAdmin } from '../../../middleware/security';
import { logger } from '../../../utils/logger';

const router = Router();

/**
 * GET /api/admin/sla/metrics
 * Get all SLA metrics
 */
router.get('/metrics', authenticateAdmin, async (req, res) => {
  try {
    const metrics = await slaMonitor.getAllSlaMetrics();
    res.json({ success: true, metrics });
  } catch (error) {
    logger.error('Failed to get SLA metrics:', error);
    res.status(500).json({ error: 'Failed to get SLA metrics' });
  }
});

/**
 * GET /api/admin/sla/metrics/:endpoint
 * Get SLA metrics for specific endpoint
 */
router.get('/metrics/:endpoint(*)', authenticateAdmin, async (req, res) => {
  try {
    const endpoint = `/${req.params.endpoint}`;
    const method = req.query.method as string;
    
    const metrics = await slaMonitor.getSlaMetrics(endpoint, method);
    if (!metrics) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    
    res.json({ success: true, metrics });
  } catch (error) {
    logger.error('Failed to get endpoint SLA metrics:', error);
    res.status(500).json({ error: 'Failed to get endpoint SLA metrics' });
  }
});

/**
 * GET /api/admin/sla/summary
 * Get SLA summary dashboard
 */
router.get('/summary', authenticateAdmin, async (req, res) => {
  try {
    const summary = await slaMonitor.getSlaSummary();
    res.json({ success: true, summary });
  } catch (error) {
    logger.error('Failed to get SLA summary:', error);
    res.status(500).json({ error: 'Failed to get SLA summary' });
  }
});

/**
 * GET /api/admin/sla/violations
 * Get SLA violations
 */
router.get('/violations', authenticateAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const violations = await slaMonitor.getSlaViolations(limit);
    res.json({ success: true, violations });
  } catch (error) {
    logger.error('Failed to get SLA violations:', error);
    res.status(500).json({ error: 'Failed to get SLA violations' });
  }
});

/**
 * GET /api/admin/sla/thresholds
 * Get all SLA thresholds
 */
router.get('/thresholds', authenticateAdmin, async (req, res) => {
  try {
    const thresholds = slaMonitor.getAllThresholds();
    res.json({ success: true, thresholds });
  } catch (error) {
    logger.error('Failed to get SLA thresholds:', error);
    res.status(500).json({ error: 'Failed to get SLA thresholds' });
  }
});

/**
 * PUT /api/admin/sla/thresholds
 * Update SLA threshold
 */
router.put('/thresholds', authenticateAdmin, async (req, res) => {
  try {
    const { endpoint, method, maxResponseTimeMs, maxErrorRate, minAvailability, enabled } = req.body;
    
    if (!endpoint || typeof maxResponseTimeMs !== 'number' || typeof maxErrorRate !== 'number' || typeof minAvailability !== 'number') {
      return res.status(400).json({ error: 'Invalid threshold data' });
    }
    
    await slaMonitor.updateThreshold({
      endpoint,
      method,
      maxResponseTimeMs,
      maxErrorRate,
      minAvailability,
      enabled: enabled !== false
    });
    
    res.json({ success: true, message: 'SLA threshold updated' });
  } catch (error) {
    logger.error('Failed to update SLA threshold:', error);
    res.status(500).json({ error: 'Failed to update SLA threshold' });
  }
});

export default router;