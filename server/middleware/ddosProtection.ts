import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../db/redis';
import { logger } from '../utils/logger';

interface SuspiciousActivity {
  ip: string;
  path: string;
  userAgent: string;
  timestamp: Date;
  reason: string;
}

interface IPStats {
  ip: string;
  requestCount: number;
  errorCount: number;
  lastRequest: Date;
  firstSeen: Date;
  blockedUntil?: Date;
  suspiciousScore: number;
  patterns: string[];
}

export class DdosProtection {
  private suspiciousIPs = new Map<string, IPStats>();
  private whitelist = new Set<string>();
  private blacklist = new Set<string>();
  
  // Configurable thresholds
  private readonly SUSPICIOUS_THRESHOLD = 100; // requests per minute
  private readonly ERROR_THRESHOLD = 20; // errors per minute
  private readonly BLOCK_DURATION_MINUTES = 60;
  private readonly MAX_BLOCK_DURATION_HOURS = 24;
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeWhitelist();
    this.startCleanup();
  }

  /**
   * Initialize IP whitelist (localhost, private networks, etc.)
   */
  private initializeWhitelist(): void {
    const defaultWhitelist = [
      '127.0.0.1',
      '::1',
      'localhost'
    ];

    // Add custom whitelist from environment
    const customWhitelist = process.env.IP_WHITELIST?.split(',') || [];
    
    [...defaultWhitelist, ...customWhitelist].forEach(ip => {
      this.whitelist.add(ip.trim());
    });

    logger.info(`🛡️ DDoS protection initialized with ${this.whitelist.size} whitelisted IPs`);
  }

  /**
   * Main DDoS protection middleware
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const clientIP = this.getClientIP(req);
      
      try {
        // Skip whitelisted IPs
        if (this.whitelist.has(clientIP)) {
          return next();
        }

        // Check if IP is blacklisted
        if (await this.isBlacklisted(clientIP)) {
          return this.blockRequest(res, 'IP blacklisted', clientIP);
        }

        // Check if IP is temporarily blocked
        const ipStats = await this.getIPStats(clientIP);
        if (ipStats.blockedUntil && new Date() < ipStats.blockedUntil) {
          const remainingTime = Math.ceil((ipStats.blockedUntil.getTime() - Date.now()) / 60000);
          return this.blockRequest(res, `Temporarily blocked (${remainingTime}m remaining)`, clientIP);
        }

        // Analyze request patterns
        const suspiciousScore = await this.analyzeSuspiciousActivity(req, ipStats);
        
        // Update IP statistics
        await this.updateIPStats(clientIP, req, suspiciousScore);

        // Check if IP should be blocked
        if (suspiciousScore > this.SUSPICIOUS_THRESHOLD) {
          await this.blockIP(clientIP, suspiciousScore);
          return this.blockRequest(res, 'Suspicious activity detected', clientIP);
        }

        next();
      } catch (error) {
        logger.error('DDoS protection error:', error);
        // Fail open - allow request if protection fails
        next();
      }
    };
  }

  /**
   * Rate limiting with different tiers
   */
  createRateLimiter(tier: 'strict' | 'normal' | 'lenient' = 'normal') {
    const configs = {
      strict: { windowMs: 15 * 60 * 1000, max: 50 },
      normal: { windowMs: 15 * 60 * 1000, max: 1000 },
      lenient: { windowMs: 15 * 60 * 1000, max: 5000 }
    };

    const config = configs[tier];

    return rateLimit({
      windowMs: config.windowMs,
      max: (req) => {
        const clientIP = this.getClientIP(req);
        
        // Whitelisted IPs get higher limits
        if (this.whitelist.has(clientIP)) {
          return config.max * 10;
        }

        // Admin endpoints get higher limits (monitor page polls frequently)
        if (req.path.startsWith('/api/admin')) {
          return config.max * 10;
        }

        // API endpoints
        if (req.path.startsWith('/api/')) {
          return config.max;
        }

        // Static assets get higher limits
        if (this.isStaticAsset(req.path)) {
          return config.max * 5;
        }

        return config.max;
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        const clientIP = this.getClientIP(req);
        this.logSuspiciousActivity(clientIP, req.path, req.get('User-Agent') || '', 'Rate limit exceeded');
        
        res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil(config.windowMs / 1000),
          message: 'Please slow down your requests'
        });
      },
      skip: (req) => {
        const clientIP = this.getClientIP(req);
        return this.whitelist.has(clientIP);
      }
    });
  }

  /**
   * Analyze suspicious activity patterns
   */
  private async analyzeSuspiciousActivity(req: Request, ipStats: IPStats): Promise<number> {
    let suspiciousScore = 0;
    const patterns: string[] = [];

    // High request frequency
    const now = new Date();
    const minuteAgo = new Date(now.getTime() - 60 * 1000);
    if (ipStats.lastRequest > minuteAgo && ipStats.requestCount > 100) {
      suspiciousScore += 30;
      patterns.push('high_frequency');
    }

    // High error rate
    if (ipStats.errorCount > this.ERROR_THRESHOLD) {
      suspiciousScore += 25;
      patterns.push('high_errors');
    }

    // Suspicious user agents
    const userAgent = req.get('User-Agent') || '';
    if (this.isSuspiciousUserAgent(userAgent)) {
      suspiciousScore += 20;
      patterns.push('suspicious_ua');
    }

    // Scanning behavior (accessing non-existent endpoints)
    if (this.isScanningBehavior(req.path)) {
      suspiciousScore += 15;
      patterns.push('scanning');
    }


    // Rapid sequential requests to different endpoints
    if (await this.isRapidSequentialAccess(this.getClientIP(req))) {
      suspiciousScore += 20;
      patterns.push('rapid_sequential');
    }

    // Update patterns in IP stats
    ipStats.patterns = [...new Set([...ipStats.patterns, ...patterns])];

    return suspiciousScore;
  }

  /**
   * Block IP temporarily
   */
  private async blockIP(ip: string, score: number): Promise<void> {
    const blockDuration = Math.min(
      this.BLOCK_DURATION_MINUTES * Math.floor(score / 50),
      this.MAX_BLOCK_DURATION_HOURS * 60
    );

    const blockedUntil = new Date();
    blockedUntil.setMinutes(blockedUntil.getMinutes() + blockDuration);

    const ipStats = await this.getIPStats(ip);
    ipStats.blockedUntil = blockedUntil;
    ipStats.suspiciousScore = score;

    await this.storeIPStats(ip, ipStats);

    logger.warn(`🚫 Blocked IP ${ip} for ${blockDuration} minutes (score: ${score})`, {
      ip,
      blockDuration,
      score,
      patterns: ipStats.patterns
    });
  }

  /**
   * Add IP to permanent blacklist
   */
  async addToBlacklist(ip: string, reason: string): Promise<void> {
    this.blacklist.add(ip);
    
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.sAdd('ddos:blacklist', ip);
        await redis.hSet(`ddos:blacklist:${ip}`, {
          ip,
          reason,
          addedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Failed to store blacklist entry:', error);
    }

    logger.warn(`⚫ Added IP ${ip} to blacklist: ${reason}`);
  }

  /**
   * Remove IP from blacklist
   */
  async removeFromBlacklist(ip: string): Promise<void> {
    this.blacklist.delete(ip);
    
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.sRem('ddos:blacklist', ip);
        await redis.del(`ddos:blacklist:${ip}`);
      }
    } catch (error) {
      logger.error('Failed to remove blacklist entry:', error);
    }

    logger.info(`✅ Removed IP ${ip} from blacklist`);
  }

  /**
   * Get DDoS protection statistics
   */
  async getStats(): Promise<{
    blockedIPs: number;
    blacklistedIPs: number;
    whitelistedIPs: number;
    suspiciousIPs: number;
    totalRequests: number;
    blockedRequests: number;
  }> {
    const now = new Date();
    let blockedIPs = 0;
    let suspiciousIPs = 0;

    for (const [ip, stats] of this.suspiciousIPs) {
      if (stats.blockedUntil && now < stats.blockedUntil) {
        blockedIPs++;
      }
      if (stats.suspiciousScore > 50) {
        suspiciousIPs++;
      }
    }

    return {
      blockedIPs,
      blacklistedIPs: this.blacklist.size,
      whitelistedIPs: this.whitelist.size,
      suspiciousIPs,
      totalRequests: 0, // Would need to track this
      blockedRequests: 0 // Would need to track this
    };
  }

  /**
   * Get blocked IPs list
   */
  async getBlockedIPs(): Promise<Array<{
    ip: string;
    blockedUntil: Date;
    suspiciousScore: number;
    patterns: string[];
    requestCount: number;
    errorCount: number;
  }>> {
    const now = new Date();
    const blocked: any[] = [];

    for (const [ip, stats] of this.suspiciousIPs) {
      if (stats.blockedUntil && now < stats.blockedUntil) {
        blocked.push({
          ip,
          blockedUntil: stats.blockedUntil,
          suspiciousScore: stats.suspiciousScore,
          patterns: stats.patterns,
          requestCount: stats.requestCount,
          errorCount: stats.errorCount
        });
      }
    }

    return blocked.sort((a, b) => b.suspiciousScore - a.suspiciousScore);
  }

  /**
   * Manually unblock IP
   */
  async unblockIP(ip: string): Promise<boolean> {
    const stats = this.suspiciousIPs.get(ip);
    if (stats && stats.blockedUntil) {
      delete stats.blockedUntil;
      stats.suspiciousScore = 0;
      stats.patterns = [];
      await this.storeIPStats(ip, stats);
      
      logger.info(`🔓 Manually unblocked IP: ${ip}`);
      return true;
    }
    return false;
  }

  // Private helper methods

  private getClientIP(req: Request): string {
    return (
      req.headers['cf-connecting-ip'] ||
      req.headers['x-forwarded-for'] ||
      req.headers['x-real-ip'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      '127.0.0.1'
    ) as string;
  }

  private async isBlacklisted(ip: string): Promise<boolean> {
    if (this.blacklist.has(ip)) return true;

    try {
      const redis = await getRedisClient();
      if (redis) {
        const isBlacklisted = await redis.sIsMember('ddos:blacklist', ip);
        if (isBlacklisted) {
          this.blacklist.add(ip);
          return true;
        }
      }
    } catch (error) {
      logger.error('Failed to check blacklist:', error);
    }

    return false;
  }

  private async getIPStats(ip: string): Promise<IPStats> {
    if (this.suspiciousIPs.has(ip)) {
      return this.suspiciousIPs.get(ip)!;
    }

    const stats: IPStats = {
      ip,
      requestCount: 0,
      errorCount: 0,
      lastRequest: new Date(),
      firstSeen: new Date(),
      suspiciousScore: 0,
      patterns: []
    };

    this.suspiciousIPs.set(ip, stats);
    return stats;
  }

  private async updateIPStats(ip: string, req: Request, suspiciousScore: number): Promise<void> {
    const stats = await this.getIPStats(ip);
    const now = new Date();
    
    // Reset counters if more than a minute has passed
    if (now.getTime() - stats.lastRequest.getTime() > 60000) {
      stats.requestCount = 1;
      stats.errorCount = 0;
    } else {
      stats.requestCount++;
    }
    
    stats.lastRequest = now;
    stats.suspiciousScore = Math.max(stats.suspiciousScore, suspiciousScore);
    
    await this.storeIPStats(ip, stats);
  }

  private async storeIPStats(ip: string, stats: IPStats): Promise<void> {
    this.suspiciousIPs.set(ip, stats);

    try {
      const redis = await getRedisClient();
      if (redis) {
        const data = {
          ...stats,
          lastRequest: stats.lastRequest.toISOString(),
          firstSeen: stats.firstSeen.toISOString(),
          blockedUntil: stats.blockedUntil?.toISOString() || '',
          patterns: JSON.stringify(stats.patterns)
        };

        await redis.hSet(`ddos:ip:${ip}`, data as any);
        await redis.expire(`ddos:ip:${ip}`, 24 * 60 * 60); // 24 hours TTL
      }
    } catch (error) {
      logger.error('Failed to store IP stats:', error);
    }
  }

  private blockRequest(res: Response, reason: string, ip: string): void {
    logger.warn(`🚫 Blocked request from ${ip}: ${reason}`);
    
    res.status(429).json({
      error: 'Access denied',
      reason: 'Your IP has been temporarily blocked due to suspicious activity',
      contact: 'If you believe this is an error, please contact support'
    });
  }

  private logSuspiciousActivity(ip: string, path: string, userAgent: string, reason: string): void {
    logger.warn(`🚨 Suspicious activity: ${ip} - ${reason}`, {
      ip,
      path,
      userAgent: userAgent.substring(0, 100),
      reason
    });
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    if (userAgent.length === 0) return true;
    const suspiciousPatterns = [
      /masscan/i, /zgrab/i, /nikto/i, /sqlmap/i,
      /nmap/i, /dirbuster/i, /nuclei/i, /gobuster/i,
      /hack/i, /exploit/i, /shellshock/i,
    ];
    return suspiciousPatterns.some(pattern => pattern.test(userAgent)) ||
           userAgent.length > 500;
  }

  private isScanningBehavior(path: string): boolean {
    const scanningPatterns = [
      /\.php$/i, /\.asp$/i, /\.jsp$/i,
      /wp-admin/i, /phpmyadmin/i,
      /\.env/i, /\.git/i, /\.svn/i,
      /backup/i,
    ];
    return scanningPatterns.some(pattern => pattern.test(path));
  }

  private isStaticAsset(path: string): boolean {
    return /\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i.test(path);
  }

  private async isRapidSequentialAccess(ip: string): Promise<boolean> {
    try {
      const redis = await getRedisClient();
      if (!redis) return false;

      const key = `ddos:rapid:${ip}`;
      const count = await redis.incr(key);
      
      if (count === 1) {
        await redis.expire(key, 10); // 10 seconds window
      }
      
      return count > 20; // More than 20 requests in 10 seconds
    } catch (error) {
      return false;
    }
  }

  private startCleanup(): void {
    setInterval(() => {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

      for (const [ip, stats] of this.suspiciousIPs) {
        if (stats.lastRequest < cutoff && (!stats.blockedUntil || now > stats.blockedUntil)) {
          this.suspiciousIPs.delete(ip);
        }
      }
    }, this.CLEANUP_INTERVAL);
  }
}

export const ddosProtection = new DdosProtection();