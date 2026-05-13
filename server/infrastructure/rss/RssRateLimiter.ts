import { getRedisClient } from '../../db/redis';
import { logger } from '../../utils/logger';

interface RateLimitConfig {
  domain: string;
  requestsPerMinute: number;
  requestsPerHour: number;
  burstLimit: number;
  backoffMultiplier: number;
  maxBackoffMinutes: number;
}

interface RateLimitState {
  domain: string;
  requestCount: number;
  hourlyRequestCount: number;
  lastRequest: Date;
  backoffUntil?: Date;
  consecutiveErrors: number;
  lastError?: string;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // seconds
  reason?: string;
  currentRate: number;
  limit: number;
}

export class RssRateLimiter {
  private memoryCache = new Map<string, RateLimitState>();
  private readonly WINDOW_SIZE_MINUTES = 1;
  private readonly WINDOW_SIZE_HOURS = 1;
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  // Default rate limits by domain type
  private readonly DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
    'localhost': {
      domain: 'localhost',
      requestsPerMinute: 60,
      requestsPerHour: 3600,
      burstLimit: 10,
      backoffMultiplier: 1.5,
      maxBackoffMinutes: 30
    },
    'lenta.ru': {
      domain: 'lenta.ru',
      requestsPerMinute: 30,
      requestsPerHour: 1800,
      burstLimit: 5,
      backoffMultiplier: 2.0,
      maxBackoffMinutes: 60
    },
    'rbc.ru': {
      domain: 'rbc.ru',
      requestsPerMinute: 20,
      requestsPerHour: 1200,
      burstLimit: 3,
      backoffMultiplier: 2.0,
      maxBackoffMinutes: 60
    },
    'habr.com': {
      domain: 'habr.com',
      requestsPerMinute: 15,
      requestsPerHour: 900,
      burstLimit: 3,
      backoffMultiplier: 1.8,
      maxBackoffMinutes: 45
    },
    'default': {
      domain: 'default',
      requestsPerMinute: 10,
      requestsPerHour: 600,
      burstLimit: 2,
      backoffMultiplier: 2.5,
      maxBackoffMinutes: 120
    }
  };

  constructor() {
    // Cleanup old entries periodically
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
    // Fix any WRONGTYPE keys from previous versions
    this.migrateRedisKeys();
  }

  private async migrateRedisKeys(): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (!redis) return;
      // Old keys without ratelimit: prefix
      const oldKeys = await redis.keys('timestamps:*');
      if (oldKeys.length > 0) {
        await redis.del(oldKeys);
        logger.info(`🧹 Cleaned up ${oldKeys.length} legacy rate limit keys`);
      }
    } catch (error) {
      logger.error('Failed to migrate rate limit keys:', error);
    }
  }

  /**
   * Check if request is allowed for given domain
   */
  async canMakeRequest(domain: string): Promise<RateLimitResult> {
    const config = this.getConfigForDomain(domain);
    const now = new Date();

    try {
      // Try Redis first, fallback to memory
      const state = await this.getState(domain) || this.getMemoryState(domain);
      
      // Check if in backoff period
      if (state.backoffUntil && now < state.backoffUntil) {
        const retryAfter = Math.ceil((state.backoffUntil.getTime() - now.getTime()) / 1000);
        return {
          allowed: false,
          retryAfter,
          reason: `Backoff period active due to errors`,
          currentRate: state.requestCount,
          limit: config.requestsPerMinute
        };
      }

      // Calculate current rate (sliding window)
      const minuteWindow = this.getMinuteWindow(now);
      const hourWindow = this.getHourWindow(now);
      
      // Reset counters if window changed
      if (this.getMinuteWindow(state.lastRequest) !== minuteWindow) {
        state.requestCount = 0;
      }
      if (this.getHourWindow(state.lastRequest) !== hourWindow) {
        state.hourlyRequestCount = 0;
      }

      // Check minute limit
      if (state.requestCount >= config.requestsPerMinute) {
        return {
          allowed: false,
          retryAfter: 60 - (now.getSeconds()),
          reason: `Rate limit exceeded: ${state.requestCount}/${config.requestsPerMinute} per minute`,
          currentRate: state.requestCount,
          limit: config.requestsPerMinute
        };
      }

      // Check hourly limit
      if (state.hourlyRequestCount >= config.requestsPerHour) {
        const nextHour = new Date(now);
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        const retryAfter = Math.ceil((nextHour.getTime() - now.getTime()) / 1000);
        
        return {
          allowed: false,
          retryAfter,
          reason: `Hourly limit exceeded: ${state.hourlyRequestCount}/${config.requestsPerHour} per hour`,
          currentRate: state.hourlyRequestCount,
          limit: config.requestsPerHour
        };
      }

      // Check burst limit (requests in last 10 seconds)
      const recentRequests = await this.getRecentRequestCount(domain, 10);
      if (recentRequests >= config.burstLimit) {
        return {
          allowed: false,
          retryAfter: 10,
          reason: `Burst limit exceeded: ${recentRequests}/${config.burstLimit} in 10 seconds`,
          currentRate: recentRequests,
          limit: config.burstLimit
        };
      }

      return {
        allowed: true,
        currentRate: state.requestCount,
        limit: config.requestsPerMinute
      };

    } catch (error) {
      logger.error(`Rate limiter error for ${domain}:`, error);
      // Fail open - allow request if rate limiter fails
      return {
        allowed: true,
        currentRate: 0,
        limit: config.requestsPerMinute
      };
    }
  }

  /**
   * Record a successful request
   */
  async recordRequest(domain: string): Promise<void> {
    const now = new Date();
    
    try {
      const state = await this.getState(domain) || this.getMemoryState(domain);
      
      // Update counters
      const minuteWindow = this.getMinuteWindow(now);
      const hourWindow = this.getHourWindow(now);
      
      if (this.getMinuteWindow(state.lastRequest) !== minuteWindow) {
        state.requestCount = 1;
      } else {
        state.requestCount++;
      }
      
      if (this.getHourWindow(state.lastRequest) !== hourWindow) {
        state.hourlyRequestCount = 1;
      } else {
        state.hourlyRequestCount++;
      }
      
      state.lastRequest = now;
      state.consecutiveErrors = 0; // Reset error count on success
      delete state.backoffUntil;
      delete state.lastError;

      await this.setState(domain, state);
      
      // Record request timestamp for burst detection
      await this.recordRequestTimestamp(domain, now);
      
    } catch (error) {
      logger.error(`Failed to record request for ${domain}:`, error);
    }
  }

  /**
   * Record a failed request and apply backoff if needed
   */
  async recordError(domain: string, error: string): Promise<void> {
    const now = new Date();
    const config = this.getConfigForDomain(domain);
    
    try {
      const state = await this.getState(domain) || this.getMemoryState(domain);
      
      state.consecutiveErrors++;
      state.lastError = error;
      state.lastRequest = now;

      // Apply exponential backoff for certain error types
      if (this.shouldApplyBackoff(error)) {
        const backoffMinutes = Math.min(
          Math.pow(config.backoffMultiplier, state.consecutiveErrors - 1),
          config.maxBackoffMinutes
        );
        
        state.backoffUntil = new Date(now.getTime() + backoffMinutes * 60 * 1000);
        
        logger.warn(`Applied ${backoffMinutes}min backoff to ${domain} after ${state.consecutiveErrors} consecutive errors`);
      }

      await this.setState(domain, state);
      
    } catch (err) {
      logger.error(`Failed to record error for ${domain}:`, err);
    }
  }

  /**
   * Get rate limit statistics for domain
   */
  async getStats(domain: string): Promise<{
    domain: string;
    config: RateLimitConfig;
    state: RateLimitState;
    isBackedOff: boolean;
    backoffRemaining?: number;
  }> {
    const config = this.getConfigForDomain(domain);
    const state = await this.getState(domain) || this.getMemoryState(domain);
    const now = new Date();
    
    const isBackedOff = !!(state.backoffUntil && now < state.backoffUntil);
    const backoffRemaining = isBackedOff 
      ? Math.ceil((state.backoffUntil!.getTime() - now.getTime()) / 1000)
      : undefined;

    return {
      domain,
      config,
      state,
      isBackedOff,
      backoffRemaining
    };
  }

  /**
   * Get all domains with their current stats
   */
  async getAllStats(): Promise<Array<{
    domain: string;
    requestsPerMinute: number;
    hourlyRequests: number;
    consecutiveErrors: number;
    isBackedOff: boolean;
    backoffRemaining?: number;
    lastRequest?: Date;
    lastError?: string;
  }>> {
    const stats: Array<any> = [];
    
    // Get from Redis
    try {
      const redis = await getRedisClient();
      if (redis) {
        const keys = await redis.keys('ratelimit:*');
        for (const key of keys) {
          const domain = key.replace('ratelimit:', '');
          const domainStats = await this.getStats(domain);
          stats.push({
            domain,
            requestsPerMinute: domainStats.state.requestCount,
            hourlyRequests: domainStats.state.hourlyRequestCount,
            consecutiveErrors: domainStats.state.consecutiveErrors,
            isBackedOff: domainStats.isBackedOff,
            backoffRemaining: domainStats.backoffRemaining,
            lastRequest: domainStats.state.lastRequest,
            lastError: domainStats.state.lastError
          });
        }
      }
    } catch (error) {
      logger.error('Failed to get Redis rate limit stats:', error);
    }
    
    // Add memory cache entries
    for (const [domain, state] of this.memoryCache) {
      if (!stats.find(s => s.domain === domain)) {
        const now = new Date();
        const isBackedOff = !!(state.backoffUntil && now < state.backoffUntil);
        const backoffRemaining = isBackedOff 
          ? Math.ceil((state.backoffUntil!.getTime() - now.getTime()) / 1000)
          : undefined;
          
        stats.push({
          domain,
          requestsPerMinute: state.requestCount,
          hourlyRequests: state.hourlyRequestCount,
          consecutiveErrors: state.consecutiveErrors,
          isBackedOff,
          backoffRemaining,
          lastRequest: state.lastRequest,
          lastError: state.lastError
        });
      }
    }
    
    return stats.sort((a, b) => a.domain.localeCompare(b.domain));
  }

  /**
   * Reset rate limits for domain (admin function)
   */
  async resetDomain(domain: string): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.del(`ratelimit:${domain}`);
        await redis.del(`ratelimit:timestamps:${domain}`);
      }
      
      this.memoryCache.delete(domain);
      
      logger.info(`Rate limits reset for domain: ${domain}`);
    } catch (error) {
      logger.error(`Failed to reset rate limits for ${domain}:`, error);
    }
  }

  /**
   * Update rate limit configuration for domain
   */
  async updateConfig(domain: string, config: Partial<RateLimitConfig>): Promise<void> {
    // Store custom config in Redis
    try {
      const redis = await getRedisClient();
      if (redis) {
        const currentConfig = this.getConfigForDomain(domain);
        const newConfig = { ...currentConfig, ...config };
        await redis.hSet(`ratelimit:config:${domain}`, newConfig as any);
        logger.info(`Updated rate limit config for ${domain}:`, config);
      }
    } catch (error) {
      logger.error(`Failed to update config for ${domain}:`, error);
    }
  }

  // Private methods

  private getConfigForDomain(domain: string): RateLimitConfig {
    // Check for exact match first
    if (this.DEFAULT_CONFIGS[domain]) {
      return this.DEFAULT_CONFIGS[domain];
    }
    
    // Check for partial matches (e.g., subdomain.example.com -> example.com)
    for (const configDomain of Object.keys(this.DEFAULT_CONFIGS)) {
      if (domain.includes(configDomain)) {
        return this.DEFAULT_CONFIGS[configDomain];
      }
    }
    
    return this.DEFAULT_CONFIGS.default;
  }

  private async getState(domain: string): Promise<RateLimitState | null> {
    try {
      const redis = await getRedisClient();
      if (!redis) return null;

      const data = await redis.hGetAll(`ratelimit:${domain}`);
      if (!data || !data.domain) return null;

      return {
        domain: data.domain,
        requestCount: parseInt(data.requestCount) || 0,
        hourlyRequestCount: parseInt(data.hourlyRequestCount) || 0,
        lastRequest: new Date(data.lastRequest),
        backoffUntil: data.backoffUntil ? new Date(data.backoffUntil) : undefined,
        consecutiveErrors: parseInt(data.consecutiveErrors) || 0,
        lastError: data.lastError || undefined
      };
    } catch (error) {
      logger.error(`Failed to get rate limit state for ${domain}:`, error);
      return null;
    }
  }

  private async setState(domain: string, state: RateLimitState): Promise<void> {
    // Store in memory cache
    this.memoryCache.set(domain, { ...state });

    // Store in Redis if available
    try {
      const redis = await getRedisClient();
      if (redis) {
        const data: Record<string, string> = {
          domain: state.domain,
          requestCount: state.requestCount.toString(),
          hourlyRequestCount: state.hourlyRequestCount.toString(),
          lastRequest: state.lastRequest.toISOString(),
          consecutiveErrors: state.consecutiveErrors.toString()
        };

        if (state.backoffUntil) {
          data.backoffUntil = state.backoffUntil.toISOString();
        }
        if (state.lastError) {
          data.lastError = state.lastError;
        }

        await redis.hSet(`ratelimit:${domain}`, data);
        await redis.expire(`ratelimit:${domain}`, 24 * 60 * 60); // 24 hours TTL
      }
    } catch (error) {
      logger.error(`Failed to store rate limit state for ${domain}:`, error);
    }
  }

  private getMemoryState(domain: string): RateLimitState {
    if (this.memoryCache.has(domain)) {
      return this.memoryCache.get(domain)!;
    }

    const newState: RateLimitState = {
      domain,
      requestCount: 0,
      hourlyRequestCount: 0,
      lastRequest: new Date(0),
      consecutiveErrors: 0
    };

    this.memoryCache.set(domain, newState);
    return newState;
  }

  private async recordRequestTimestamp(domain: string, timestamp: Date): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (redis) {
        const key = `ratelimit:timestamps:${domain}`;
        try {
          await redis.lPush(key, timestamp.getTime().toString());
          await redis.lTrim(key, 0, 99);
          await redis.expire(key, 3600);
        } catch (e: any) {
          if (e?.message?.includes('WRONGTYPE')) {
            await redis.del(key);
            await redis.lPush(key, timestamp.getTime().toString());
            await redis.expire(key, 3600);
          } else throw e;
        }
      }
    } catch (error) {
      logger.error(`Failed to record timestamp for ${domain}:`, error);
    }
  }

  private async getRecentRequestCount(domain: string, seconds: number): Promise<number> {
    try {
      const redis = await getRedisClient();
      if (!redis) return 0;

      const key = `ratelimit:timestamps:${domain}`;
      let timestamps: string[];
      try {
        timestamps = await redis.lRange(key, 0, -1);
      } catch (e: any) {
        if (e?.message?.includes('WRONGTYPE')) {
          await redis.del(key);
          return 0;
        }
        throw e;
      }
      const cutoff = Date.now() - (seconds * 1000);
      return timestamps.filter(ts => parseInt(ts) > cutoff).length;
    } catch (error) {
      logger.error(`Failed to get recent request count for ${domain}:`, error);
      return 0;
    }
  }

  private getMinuteWindow(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
  }

  private getHourWindow(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
  }

  private shouldApplyBackoff(error: string): boolean {
    const backoffErrors = [
      '503', '429', '502', '504',
      'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND',
      'Too Many Requests', 'Service Unavailable',
      'Заблокировано', 'Blocked'
    ];

    return backoffErrors.some(pattern => error.includes(pattern));
  }

  private cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [domain, state] of this.memoryCache) {
      if (now - state.lastRequest.getTime() > maxAge) {
        this.memoryCache.delete(domain);
      }
    }
  }
}

export const rssRateLimiter = new RssRateLimiter();