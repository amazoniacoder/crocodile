import { Router } from 'express';
import { authenticateAdmin } from '../../../middleware/security';
import { apiKeyService } from '../../../infrastructure/auth/ApiKeyService';
import { logger } from '../../../utils/logger';

const router = Router();

// GET /api/admin/api-keys
router.get('/', authenticateAdmin, async (_req, res) => {
  try {
    const keys = await apiKeyService.list();
    res.json({ success: true, keys });
  } catch (err) {
    logger.error('Failed to list API keys:', err);
    res.status(500).json({ success: false, error: 'Failed to list API keys' });
  }
});

// POST /api/admin/api-keys
router.post('/', authenticateAdmin, async (req, res) => {
  const { name, requestsPerMinute, requestsPerDay } = req.body ?? {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ success: false, error: 'name is required' });
  }
  try {
    const result = await apiKeyService.create(name, { requestsPerMinute, requestsPerDay });
    logger.info(`🔑 API key created by admin: ${name}`);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    logger.error('Failed to create API key:', err);
    res.status(500).json({ success: false, error: 'Failed to create API key' });
  }
});

// DELETE /api/admin/api-keys/:id
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const ok = await apiKeyService.revoke(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: 'Key not found' });
    logger.info(`🔑 API key revoked by admin: ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to revoke API key:', err);
    res.status(500).json({ success: false, error: 'Failed to revoke API key' });
  }
});

export default router;
