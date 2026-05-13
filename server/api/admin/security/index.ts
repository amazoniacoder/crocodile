import { Router } from 'express';
import { authenticateAdmin } from '../../../middleware/security';
import { ddosProtection } from '../../../middleware/ddosProtection';
import { logger } from '../../../utils/logger';

const router = Router();

/**
 * GET /api/admin/security/ddos/stats
 * Get DDoS protection statistics
 */
router.get('/ddos/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await ddosProtection.getStats();
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get DDoS stats:', error);
    res.status(500).json({ error: 'Failed to retrieve DDoS statistics' });
  }
});

/**
 * GET /api/admin/security/ddos/blocked
 * Get list of blocked IPs
 */
router.get('/ddos/blocked', authenticateAdmin, async (req, res) => {
  try {
    const blockedIPs = await ddosProtection.getBlockedIPs();
    
    res.json({
      success: true,
      blockedIPs,
      count: blockedIPs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get blocked IPs:', error);
    res.status(500).json({ error: 'Failed to retrieve blocked IPs' });
  }
});

/**
 * POST /api/admin/security/ddos/unblock
 * Unblock an IP address
 */
router.post('/ddos/unblock', authenticateAdmin, async (req, res) => {
  try {
    const { ip } = req.body;
    const tokenInfo = (req as any).tokenInfo;
    
    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({ error: 'IP address is required' });
    }
    
    // Validate IP format
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip)) {
      return res.status(400).json({ error: 'Invalid IP address format' });
    }
    
    const success = await ddosProtection.unblockIP(ip);
    
    if (success) {
      logger.info(`🔓 IP unblocked by admin: ${ip}`, {
        ip,
        unblockedBy: tokenInfo?.name || 'admin'
      });
      
      res.json({
        success: true,
        message: `IP ${ip} has been unblocked`,
        ip
      });
    } else {
      res.status(404).json({ error: 'IP not found in blocked list' });
    }
  } catch (error) {
    logger.error('Failed to unblock IP:', error);
    res.status(500).json({ error: 'Failed to unblock IP' });
  }
});

/**
 * POST /api/admin/security/ddos/blacklist
 * Add IP to permanent blacklist
 */
router.post('/ddos/blacklist', authenticateAdmin, async (req, res) => {
  try {
    const { ip, reason = 'Manual blacklist by admin' } = req.body;
    const tokenInfo = (req as any).tokenInfo;
    
    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({ error: 'IP address is required' });
    }
    
    // Validate IP format
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip)) {
      return res.status(400).json({ error: 'Invalid IP address format' });
    }
    
    // Prevent blacklisting localhost or private networks
    if (ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      return res.status(400).json({ error: 'Cannot blacklist private network addresses' });
    }
    
    await ddosProtection.addToBlacklist(ip, `${reason} (by ${tokenInfo?.name || 'admin'})`);
    
    logger.warn(`⚫ IP blacklisted by admin: ${ip}`, {
      ip,
      reason,
      blacklistedBy: tokenInfo?.name || 'admin'
    });
    
    res.json({
      success: true,
      message: `IP ${ip} has been added to blacklist`,
      ip,
      reason
    });
  } catch (error) {
    logger.error('Failed to blacklist IP:', error);
    res.status(500).json({ error: 'Failed to blacklist IP' });
  }
});

/**
 * DELETE /api/admin/security/ddos/blacklist/:ip
 * Remove IP from blacklist
 */
router.delete('/ddos/blacklist/:ip', authenticateAdmin, async (req, res) => {
  try {
    const { ip } = req.params;
    const tokenInfo = (req as any).tokenInfo;
    
    // Validate IP format
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip)) {
      return res.status(400).json({ error: 'Invalid IP address format' });
    }
    
    await ddosProtection.removeFromBlacklist(ip);
    
    logger.info(`✅ IP removed from blacklist by admin: ${ip}`, {
      ip,
      removedBy: tokenInfo?.name || 'admin'
    });
    
    res.json({
      success: true,
      message: `IP ${ip} has been removed from blacklist`,
      ip
    });
  } catch (error) {
    logger.error('Failed to remove IP from blacklist:', error);
    res.status(500).json({ error: 'Failed to remove IP from blacklist' });
  }
});

/**
 * GET /api/admin/security/ddos/dashboard
 * Get comprehensive DDoS protection dashboard data
 */
router.get('/ddos/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const [stats, blockedIPs] = await Promise.all([
      ddosProtection.getStats(),
      ddosProtection.getBlockedIPs()
    ]);
    
    // Group blocked IPs by pattern
    const patternStats = blockedIPs.reduce((acc, ip) => {
      ip.patterns.forEach(pattern => {
        acc[pattern] = (acc[pattern] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);
    
    // Get top suspicious IPs
    const topSuspicious = blockedIPs
      .sort((a, b) => b.suspiciousScore - a.suspiciousScore)
      .slice(0, 10);
    
    res.json({
      success: true,
      dashboard: {
        stats,
        blockedIPs: {
          total: blockedIPs.length,
          list: blockedIPs.slice(0, 20), // Latest 20 for dashboard
          topSuspicious
        },
        patterns: patternStats,
        systemStatus: {
          protectionEnabled: true,
          lastUpdate: new Date().toISOString(),
          version: '1.0.0'
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get DDoS dashboard data:', error);
    res.status(500).json({ error: 'Failed to retrieve DDoS dashboard data' });
  }
});

/**
 * POST /api/admin/security/ddos/test
 * Test DDoS protection (for debugging)
 */
router.post('/ddos/test', authenticateAdmin, async (req, res) => {
  try {
    const { testType = 'stats' } = req.body;
    const tokenInfo = (req as any).tokenInfo;
    
    let result: any = {};
    
    switch (testType) {
      case 'stats':
        result = await ddosProtection.getStats();
        break;
      case 'blocked':
        result = await ddosProtection.getBlockedIPs();
        break;
      default:
        return res.status(400).json({ error: 'Invalid test type' });
    }
    
    logger.info(`🧪 DDoS protection test executed: ${testType}`, {
      testType,
      executedBy: tokenInfo?.name || 'admin'
    });
    
    res.json({
      success: true,
      testType,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('DDoS protection test failed:', error);
    res.status(500).json({ error: 'Test execution failed' });
  }
});

export default router;