import { Router } from 'express';
import { authenticateAdmin } from '../../../middleware/security';
import { tokenManager } from '../../../infrastructure/auth/TokenManager';
import { logger } from '../../../utils/logger';

const router = Router();

/**
 * GET /api/admin/tokens
 * Get all active tokens
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const tokens = await tokenManager.getAllTokens();
    
    res.json({
      success: true,
      tokens: tokens.map(token => ({
        ...token,
        // Don't expose sensitive data
        id: token.id.substring(0, 8) + '...',
      })),
      count: tokens.length
    });
  } catch (error) {
    logger.error('Failed to get tokens:', error);
    res.status(500).json({ error: 'Failed to retrieve tokens' });
  }
});

/**
 * GET /api/admin/tokens/stats
 * Get token statistics
 */
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await tokenManager.getTokenStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Failed to get token stats:', error);
    res.status(500).json({ error: 'Failed to retrieve token statistics' });
  }
});

/**
 * POST /api/admin/tokens/generate
 * Generate a new admin token
 */
router.post('/generate', authenticateAdmin, async (req, res) => {
  try {
    const { name, expiresInDays = 30, permissions = ['admin'] } = req.body;
    const tokenInfo = (req as any).tokenInfo;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Token name is required' });
    }
    
    if (expiresInDays < 1 || expiresInDays > 365) {
      return res.status(400).json({ error: 'Expiry must be between 1 and 365 days' });
    }
    
    const result = await tokenManager.generateToken({
      name,
      expiresInDays,
      createdBy: tokenInfo?.name || 'admin',
      permissions
    });
    
    logger.info(`🔐 New token generated: ${name} by ${tokenInfo?.name}`, {
      tokenId: result.tokenId,
      expiresAt: result.expiresAt.toISOString()
    });
    
    res.json({
      success: true,
      message: 'Token generated successfully',
      data: {
        token: result.token,
        tokenId: result.tokenId.substring(0, 8) + '...',
        expiresAt: result.expiresAt.toISOString(),
        name
      }
    });
  } catch (error) {
    logger.error('Token generation failed:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

/**
 * POST /api/admin/tokens/rotate
 * Rotate current token
 */
router.post('/rotate', authenticateAdmin, async (req, res) => {
  try {
    const currentToken = req.headers.authorization?.replace('Bearer ', '');
    const { name, expiresInDays = 30 } = req.body;
    const tokenInfo = (req as any).tokenInfo;
    
    if (!currentToken) {
      return res.status(400).json({ error: 'Current token not found' });
    }
    
    const result = await tokenManager.rotateToken(currentToken, {
      name: name || `Rotated ${tokenInfo?.name || 'token'}`,
      expiresInDays,
      createdBy: tokenInfo?.name || 'admin'
    });
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    logger.info(`🔄 Token rotated by ${tokenInfo?.name}`, {
      newTokenId: result.tokenId,
      expiresAt: result.expiresAt?.toISOString()
    });
    
    res.json({
      success: true,
      message: 'Token rotated successfully',
      data: {
        newToken: result.newToken,
        tokenId: result.tokenId?.substring(0, 8) + '...',
        expiresAt: result.expiresAt?.toISOString(),
        gracePeriod: '24 hours for old token'
      }
    });
  } catch (error) {
    logger.error('Token rotation failed:', error);
    res.status(500).json({ error: 'Failed to rotate token' });
  }
});

/**
 * DELETE /api/admin/tokens/:tokenId
 * Revoke a token
 */
router.delete('/:tokenId', authenticateAdmin, async (req, res) => {
  try {
    const { tokenId } = req.params;
    const tokenInfo = (req as any).tokenInfo;
    
    // Prevent self-revocation
    if (tokenInfo?.tokenId === tokenId) {
      return res.status(400).json({ error: 'Cannot revoke your own token' });
    }
    
    const success = await tokenManager.revokeToken(tokenId, tokenInfo?.name || 'admin');
    
    if (success) {
      logger.info(`🚫 Token revoked: ${tokenId} by ${tokenInfo?.name}`);
      res.json({
        success: true,
        message: 'Token revoked successfully'
      });
    } else {
      res.status(404).json({ error: 'Token not found or already revoked' });
    }
  } catch (error) {
    logger.error('Token revocation failed:', error);
    res.status(500).json({ error: 'Failed to revoke token' });
  }
});

/**
 * POST /api/admin/tokens/validate
 * Validate current token (health check)
 */
router.post('/validate', authenticateAdmin, async (req, res) => {
  try {
    const currentToken = req.headers.authorization?.replace('Bearer ', '');
    const tokenInfo = (req as any).tokenInfo;
    
    if (!currentToken) {
      return res.status(400).json({ error: 'No token provided' });
    }
    
    const validation = await tokenManager.validateToken(currentToken);
    
    res.json({
      success: true,
      valid: validation.isValid,
      tokenInfo: {
        name: validation.name,
        permissions: validation.permissions,
        expiresAt: validation.expiresAt?.toISOString(),
        tokenId: tokenInfo?.tokenId?.substring(0, 8) + '...'
      }
    });
  } catch (error) {
    logger.error('Token validation check failed:', error);
    res.status(500).json({ error: 'Validation check failed' });
  }
});

/**
 * POST /api/admin/tokens/auto-rotate
 * Manually trigger auto-rotation of expiring tokens
 */
router.post('/auto-rotate', authenticateAdmin, async (req, res) => {
  try {
    const tokenInfo = (req as any).tokenInfo;
    
    await tokenManager.autoRotateExpiring();
    
    logger.info(`🔄 Manual auto-rotation triggered by ${tokenInfo?.name}`);
    
    res.json({
      success: true,
      message: 'Auto-rotation completed successfully'
    });
  } catch (error) {
    logger.error('Manual auto-rotation failed:', error);
    res.status(500).json({ error: 'Auto-rotation failed' });
  }
});

export default router;