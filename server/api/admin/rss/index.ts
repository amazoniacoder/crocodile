import { Router } from 'express';
import { rssRateLimiter } from '../../../infrastructure/rss/RssRateLimiter';
import { logger } from '../../../utils/logger';
import { authenticateAdmin } from '../../../middleware/security';

const router = Router();

/**
 * GET /api/admin/rss/rate-limits
 */
router.get('/rate-limits', authenticateAdmin, async (req, res) => {
  try {
    const stats = await rssRateLimiter.getAllStats();
    
    res.json({
      success: true,
      rateLimits: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get rate limit stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve rate limit statistics'
    });
  }
});

/**
 * GET /api/admin/rss/rate-limits/:domain
 * Get detailed rate limiting information for specific domain
 */
router.get('/rate-limits/:domain', authenticateAdmin, async (req, res) => {
  try {
    const { domain } = req.params;
    const stats = await rssRateLimiter.getStats(domain);
    
    res.json({
      success: true,
      domain,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to get rate limit stats for ${req.params.domain}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve domain rate limit statistics'
    });
  }
});

/**
 * POST /api/admin/rss/rate-limits/:domain/reset
 * Reset rate limits for specific domain
 */
router.post('/rate-limits/:domain/reset', authenticateAdmin, async (req, res) => {
  try {
    const { domain } = req.params;
    await rssRateLimiter.resetDomain(domain);
    
    logger.info(`Rate limits reset for domain: ${domain}`);
    
    res.json({
      success: true,
      message: `Rate limits reset for domain: ${domain}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to reset rate limits for ${req.params.domain}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset rate limits'
    });
  }
});

/**
 * PATCH /api/admin/rss/rate-limits/:domain/config
 * Update rate limit configuration for domain
 */
router.patch('/rate-limits/:domain/config', authenticateAdmin, async (req, res) => {
  try {
    const { domain } = req.params;
    const config = req.body;
    
    // Validate configuration
    const validFields = [
      'requestsPerMinute', 'requestsPerHour', 'burstLimit', 
      'backoffMultiplier', 'maxBackoffMinutes'
    ];
    
    const updates: any = {};
    for (const field of validFields) {
      if (config[field] !== undefined) {
        const value = Number(config[field]);
        if (isNaN(value) || value < 0) {
          return res.status(400).json({
            success: false,
            error: `Invalid value for ${field}: must be a positive number`
          });
        }
        updates[field] = value;
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid configuration fields provided'
      });
    }
    
    await rssRateLimiter.updateConfig(domain, updates);
    
    logger.info(`Updated rate limit config for ${domain}:`, updates);
    
    res.json({
      success: true,
      message: `Rate limit configuration updated for domain: ${domain}`,
      updates,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to update rate limit config for ${req.params.domain}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update rate limit configuration'
    });
  }
});

/**
 * POST /api/admin/rss/rate-limits/test
 * Test rate limiting for a domain
 */
router.post('/rate-limits/test', authenticateAdmin, async (req, res) => {
  try {
    const { domain, requests = 1 } = req.body;
    
    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Domain is required'
      });
    }
    
    const requestCount = Math.min(Math.max(1, Number(requests) || 1), 10);
    const results = [];
    
    for (let i = 0; i < requestCount; i++) {
      const result = await rssRateLimiter.canMakeRequest(domain);
      results.push({
        request: i + 1,
        allowed: result.allowed,
        reason: result.reason,
        retryAfter: result.retryAfter,
        currentRate: result.currentRate,
        limit: result.limit
      });
      
      if (result.allowed) {
        await rssRateLimiter.recordRequest(domain);
      }
      
      // Small delay between test requests
      if (i < requestCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    res.json({
      success: true,
      domain,
      requestCount,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Rate limit test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Rate limit test failed'
    });
  }
});

/**
 * GET /api/admin/rss/rate-limits/summary
 * Get summary of rate limiting across all domains
 */
router.get('/rate-limits/summary', authenticateAdmin, async (req, res) => {
  try {
    const stats = await rssRateLimiter.getAllStats();
    
    const summary = {
      totalDomains: stats.length,
      activeDomains: stats.filter(s => s.requestsPerMinute > 0 || s.hourlyRequests > 0).length,
      backedOffDomains: stats.filter(s => s.isBackedOff).length,
      domainsWithErrors: stats.filter(s => s.consecutiveErrors > 0).length,
      totalRequestsThisMinute: stats.reduce((sum, s) => sum + s.requestsPerMinute, 0),
      totalRequestsThisHour: stats.reduce((sum, s) => sum + s.hourlyRequests, 0),
      averageErrorRate: stats.length > 0 
        ? stats.reduce((sum, s) => sum + s.consecutiveErrors, 0) / stats.length 
        : 0
    };
    
    const topDomains = stats
      .filter(s => s.hourlyRequests > 0)
      .sort((a, b) => b.hourlyRequests - a.hourlyRequests)
      .slice(0, 10)
      .map(s => ({
        domain: s.domain,
        hourlyRequests: s.hourlyRequests,
        consecutiveErrors: s.consecutiveErrors,
        isBackedOff: s.isBackedOff
      }));
    
    const problemDomains = stats
      .filter(s => s.isBackedOff || s.consecutiveErrors > 0)
      .map(s => ({
        domain: s.domain,
        consecutiveErrors: s.consecutiveErrors,
        isBackedOff: s.isBackedOff,
        backoffRemaining: s.backoffRemaining,
        lastError: s.lastError
      }));
    
    res.json({
      success: true,
      summary,
      topDomains,
      problemDomains,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get rate limit summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve rate limit summary'
    });
  }
});

export default router;