import { Router } from 'express';
import { auditLogger } from '../../../infrastructure/audit/AuditLogger';
import { authenticateAdmin } from '../../../middleware/security';

const router = Router();

router.get('/logs', authenticateAdmin, async (req, res) => {
  try {
    const {
      action, resource, adminToken, success,
      fromDate, toDate, limit = '100', offset = '0'
    } = req.query;

    const filters: any = {};
    if (action) filters.action = action as string;
    if (resource) filters.resource = resource as string;
    if (adminToken) filters.adminToken = adminToken as string;
    if (success !== undefined) filters.success = success === 'true';
    if (fromDate) filters.fromDate = new Date(fromDate as string);
    if (toDate) filters.toDate = new Date(toDate as string);
    filters.limit = parseInt(limit as string, 10);
    filters.offset = parseInt(offset as string, 10);

    const logs = await auditLogger.getLogs(filters);
    res.json({ success: true, logs, total: logs.length });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

router.get('/stats', authenticateAdmin, async (_req, res) => {
  try {
    const stats = await auditLogger.getStats();
    res.json({ success: true, stats });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch audit statistics' });
  }
});

router.post('/cleanup', authenticateAdmin, async (req, res) => {
  try {
    const { olderThanDays = 180 } = req.body;
    const deletedCount = await auditLogger.cleanup(olderThanDays);
    res.json({
      success: true,
      deletedCount,
      message: `Cleaned up ${deletedCount} audit log entries older than ${olderThanDays} days`
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to cleanup audit logs' });
  }
});

export default router;
