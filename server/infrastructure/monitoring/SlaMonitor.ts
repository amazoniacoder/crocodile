import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../../db/redis';
import { logger } from '../../utils/logger';

interface ResponseTimeMetric {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
}

interface SlaMetrics {
  endpoint: string;
  method: string;
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  averageResponseTime: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  throughput: number; // requests per minute
  availability: number; // percentage
  lastUpdated: Date;
}

interface SlaThreshold {
  endpoint: string;
  method?: string;
  maxResponseTimeMs: number;
  maxErrorRate: number;
  minAvailability: number;
  enabled: boolean;
}

interface SlaViolation {
  id: string;
  endpoint: string;
  method: string;
  violationType: 'response_time' | 'error_rate' | 'availability';
  threshold: number;
  actualValue: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export class SlaMonitor {
  private metrics = new Map<string, ResponseTimeMetric[]>();
  private aggregatedMetrics = new Map<string, SlaMetrics>();
  private violations = new Map<string, SlaViolation>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private aggregationInterval: NodeJS.Timeout | null = null;
  
  // Default SLA thresholds
  private readonly DEFAULT_THRESHOLDS: SlaThreshold[] = [
    {
      endpoint: '/api/news',
      method: 'GET',
      maxResponseTimeMs: 500,
      maxErrorRate: 0.05, // 5%
      minAvailability: 0.99, // 99%
      enabled: true
    },
    {
      endpoint: '/api/news/search',
      method: 'GET',
      maxResponseTimeMs: 1000,
      maxErrorRate: 0.05,
      minAvailability: 0.98,
      enabled: true
    },
    {
      endpoint: '/api/admin/*',
      maxResponseTimeMs: 2000,
      maxErrorRate: 0.02,
      minAvailability: 0.99,
      enabled: true
    },
    {
      endpoint: '/api/health',
      maxResponseTimeMs: 200,
      maxErrorRate: 0.01,
      minAvailability: 0.999,
      enabled: true
    }
  ];

  private thresholds = new Map<string, SlaThreshold>();

  constructor() {
    this.initializeThresholds();
    this.startCleanup();
    this.startAggregation();
  }

  /**
   * Initialize default SLA thresholds
   */
  private initializeThresholds(): void {
    for (const threshold of this.DEFAULT_THRESHOLDS) {
      const key = this.getThresholdKey(threshold.endpoint, threshold.method);
      this.thresholds.set(key, threshold);
    }
    logger.info(`📊 Initialized ${this.DEFAULT_THRESHOLDS.length} SLA thresholds`);
  }

  /**
   * Express middleware for SLA monitoring
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const originalSend = res.send;

      // Override res.send to capture response time
      res.send = function(body: any) {
        // Restore original immediately to prevent double-call on error paths
        res.send = originalSend;

        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Record the metric
        const metric: ResponseTimeMetric = {
          endpoint: req.route?.path || req.path,
          method: req.method,
          statusCode: res.statusCode,
          responseTime,
          timestamp: new Date(),
          userAgent: req.get('User-Agent'),
          ip: req.ip || req.connection.remoteAddress
        };

        // Don't await this to avoid blocking the response
        setImmediate(() => {
          slaMonitor.recordMetric(metric);
        });

        return originalSend.call(this, body);
      };

      next();
    };
  }

  /**
   * Record a response time metric
   */
  async recordMetric(metric: ResponseTimeMetric): Promise<void> {
    try {
      const key = this.getMetricKey(metric.endpoint, metric.method);
      
      // Store in memory (sliding window)
      if (!this.metrics.has(key)) {
        this.metrics.set(key, []);
      }
      
      const endpointMetrics = this.metrics.get(key)!;
      endpointMetrics.push(metric);
      
      // Keep only last 1000 metrics per endpoint
      if (endpointMetrics.length > 1000) {
        endpointMetrics.splice(0, endpointMetrics.length - 1000);
      }

      // Store in Redis for persistence
      await this.storeMetricInRedis(metric);
      
    } catch (error) {
      logger.error('Failed to record SLA metric:', error);
    }
  }

  /**
   * Store metric in Redis
   */
  private async storeMetricInRedis(metric: ResponseTimeMetric): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (!redis) return;

      const key = `sla:metrics:${this.getMetricKey(metric.endpoint, metric.method)}`;
      const data = {
        endpoint: metric.endpoint,
        method: metric.method,
        statusCode: metric.statusCode.toString(),
        responseTime: metric.responseTime.toString(),
        timestamp: metric.timestamp.toISOString(),
        userAgent: metric.userAgent || '',
        ip: metric.ip || ''
      };

      await redis.lPush(key, JSON.stringify(data));
      await redis.lTrim(key, 0, 999); // Keep last 1000 metrics
      await redis.expire(key, 24 * 60 * 60); // 24 hours TTL

    } catch (error) {
      logger.error('Failed to store SLA metric in Redis:', error);
    }
  }

  /**
   * Calculate SLA metrics for an endpoint
   */
  private calculateSlaMetrics(endpoint: string, method: string): SlaMetrics {
    const key = this.getMetricKey(endpoint, method);
    const metrics = this.metrics.get(key) || [];
    
    if (metrics.length === 0) {
      return {
        endpoint,
        method,
        totalRequests: 0,
        successfulRequests: 0,
        errorRequests: 0,
        averageResponseTime: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        errorRate: 0,
        throughput: 0,
        availability: 1,
        lastUpdated: new Date()
      };
    }

    // Filter metrics from last hour for throughput calculation
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentMetrics = metrics.filter(m => m.timestamp > oneHourAgo);
    
    // Calculate basic stats
    const totalRequests = metrics.length;
    const successfulRequests = metrics.filter(m => m.statusCode < 400).length;
    const errorRequests = totalRequests - successfulRequests;
    const errorRate = totalRequests > 0 ? errorRequests / totalRequests : 0;
    const availability = totalRequests > 0 ? successfulRequests / totalRequests : 1;
    
    // Calculate response time stats
    const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b);
    const averageResponseTime = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
    
    const p50 = this.calculatePercentile(responseTimes, 0.5);
    const p95 = this.calculatePercentile(responseTimes, 0.95);
    const p99 = this.calculatePercentile(responseTimes, 0.99);
    
    // Calculate throughput (requests per minute)
    const throughput = recentMetrics.length > 0 ? (recentMetrics.length / 60) : 0;

    return {
      endpoint,
      method,
      totalRequests,
      successfulRequests,
      errorRequests,
      averageResponseTime: Math.round(averageResponseTime),
      p50: Math.round(p50),
      p95: Math.round(p95),
      p99: Math.round(p99),
      errorRate: Math.round(errorRate * 10000) / 100, // Percentage with 2 decimals
      throughput: Math.round(throughput * 100) / 100,
      availability: Math.round(availability * 10000) / 100,
      lastUpdated: new Date()
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  /**
   * Get SLA metrics for all endpoints
   */
  async getAllSlaMetrics(): Promise<SlaMetrics[]> {
    const allMetrics: SlaMetrics[] = [];
    
    // Calculate metrics for all tracked endpoints
    for (const [key] of this.metrics) {
      const [endpoint, method] = this.parseMetricKey(key);
      const slaMetrics = this.calculateSlaMetrics(endpoint, method);
      allMetrics.push(slaMetrics);
    }
    
    return allMetrics.sort((a, b) => b.totalRequests - a.totalRequests);
  }

  /**
   * Get SLA metrics for specific endpoint
   */
  async getSlaMetrics(endpoint: string, method?: string): Promise<SlaMetrics | null> {
    if (method) {
      return this.calculateSlaMetrics(endpoint, method);
    }
    
    // If no method specified, aggregate all methods for the endpoint
    const allMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    let aggregated: SlaMetrics | null = null;
    
    for (const m of allMethods) {
      const key = this.getMetricKey(endpoint, m);
      if (this.metrics.has(key)) {
        const metrics = this.calculateSlaMetrics(endpoint, m);
        if (!aggregated) {
          aggregated = { ...metrics, method: 'ALL' };
        } else {
          // Aggregate metrics
          aggregated.totalRequests += metrics.totalRequests;
          aggregated.successfulRequests += metrics.successfulRequests;
          aggregated.errorRequests += metrics.errorRequests;
          aggregated.averageResponseTime = Math.round(
            (aggregated.averageResponseTime + metrics.averageResponseTime) / 2
          );
          aggregated.p95 = Math.max(aggregated.p95, metrics.p95);
          aggregated.p99 = Math.max(aggregated.p99, metrics.p99);
          aggregated.throughput += metrics.throughput;
        }
      }
    }
    
    if (aggregated && aggregated.totalRequests > 0) {
      aggregated.errorRate = Math.round((aggregated.errorRequests / aggregated.totalRequests) * 10000) / 100;
      aggregated.availability = Math.round((aggregated.successfulRequests / aggregated.totalRequests) * 10000) / 100;
    }
    
    return aggregated;
  }

  /**
   * Check SLA violations
   */
  private async checkSlaViolations(): Promise<void> {
    for (const [key, threshold] of this.thresholds) {
      if (!threshold.enabled) continue;
      
      const [endpoint, method] = this.parseThresholdKey(key);
      const metrics = method ? 
        this.calculateSlaMetrics(endpoint, method) :
        await this.getSlaMetrics(endpoint);
      
      if (!metrics || metrics.totalRequests === 0) continue;
      
      await this.checkThresholdViolations(metrics, threshold);
    }
  }

  /**
   * Check individual threshold violations
   */
  private async checkThresholdViolations(metrics: SlaMetrics, threshold: SlaThreshold): Promise<void> {
    const violationKey = `${threshold.endpoint}:${threshold.method || 'ALL'}`;
    
    // Check response time violation
    if (metrics.p95 > threshold.maxResponseTimeMs) {
      await this.recordViolation({
        id: `${violationKey}:response_time:${Date.now()}`,
        endpoint: threshold.endpoint,
        method: threshold.method || 'ALL',
        violationType: 'response_time',
        threshold: threshold.maxResponseTimeMs,
        actualValue: metrics.p95,
        timestamp: new Date(),
        resolved: false
      });
    }
    
    // Check error rate violation
    if (metrics.errorRate > threshold.maxErrorRate * 100) {
      await this.recordViolation({
        id: `${violationKey}:error_rate:${Date.now()}`,
        endpoint: threshold.endpoint,
        method: threshold.method || 'ALL',
        violationType: 'error_rate',
        threshold: threshold.maxErrorRate * 100,
        actualValue: metrics.errorRate,
        timestamp: new Date(),
        resolved: false
      });
    }
    
    // Check availability violation
    if (metrics.availability < threshold.minAvailability * 100) {
      await this.recordViolation({
        id: `${violationKey}:availability:${Date.now()}`,
        endpoint: threshold.endpoint,
        method: threshold.method || 'ALL',
        violationType: 'availability',
        threshold: threshold.minAvailability * 100,
        actualValue: metrics.availability,
        timestamp: new Date(),
        resolved: false
      });
    }
  }

  /**
   * Record SLA violation
   */
  private async recordViolation(violation: SlaViolation): Promise<void> {
    this.violations.set(violation.id, violation);
    
    // Store in Redis
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.hSet(`sla:violation:${violation.id}`, {
          id: violation.id,
          endpoint: violation.endpoint,
          method: violation.method,
          violationType: violation.violationType,
          threshold: violation.threshold.toString(),
          actualValue: violation.actualValue.toString(),
          timestamp: violation.timestamp.toISOString(),
          resolved: violation.resolved.toString()
        });
        
        await redis.expire(`sla:violation:${violation.id}`, 7 * 24 * 60 * 60); // 7 days
        
        // Add to violations list
        await redis.lPush('sla:violations', violation.id);
        await redis.lTrim('sla:violations', 0, 999); // Keep last 1000
      }
    } catch (error) {
      logger.error('Failed to store SLA violation:', error);
    }
    
    logger.warn(`📊 SLA Violation: ${violation.endpoint} ${violation.violationType} - ${violation.actualValue} > ${violation.threshold}`, {
      violationId: violation.id,
      endpoint: violation.endpoint,
      method: violation.method,
      type: violation.violationType
    });
  }

  /**
   * Get SLA violations
   */
  async getSlaViolations(limit: number = 50): Promise<SlaViolation[]> {
    try {
      const redis = await getRedisClient();
      if (!redis) return Array.from(this.violations.values());

      const violationIds = await redis.lRange('sla:violations', 0, limit - 1);
      const violations: SlaViolation[] = [];

      for (const id of violationIds) {
        const data = await redis.hGetAll(`sla:violation:${id}`);
        if (data.id) {
          violations.push({
            id: data.id,
            endpoint: data.endpoint,
            method: data.method,
            violationType: data.violationType as SlaViolation['violationType'],
            threshold: parseFloat(data.threshold),
            actualValue: parseFloat(data.actualValue),
            timestamp: new Date(data.timestamp),
            resolved: data.resolved === 'true',
            resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : undefined
          });
        }
      }

      return violations;
    } catch (error) {
      logger.error('Failed to get SLA violations:', error);
      return Array.from(this.violations.values());
    }
  }

  /**
   * Get SLA summary
   */
  async getSlaSummary(): Promise<{
    totalEndpoints: number;
    healthyEndpoints: number;
    violatingEndpoints: number;
    totalViolations: number;
    activeViolations: number;
    averageResponseTime: number;
    overallAvailability: number;
    worstPerformingEndpoint: string | null;
  }> {
    const allMetrics = await this.getAllSlaMetrics();
    const violations = await this.getSlaViolations(100);
    
    const totalEndpoints = allMetrics.length;
    const violatingEndpoints = new Set(violations.filter(v => !v.resolved).map(v => v.endpoint)).size;
    const healthyEndpoints = totalEndpoints - violatingEndpoints;
    
    const totalRequests = allMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalSuccessful = allMetrics.reduce((sum, m) => sum + m.successfulRequests, 0);
    const overallAvailability = totalRequests > 0 ? (totalSuccessful / totalRequests) * 100 : 100;
    
    const averageResponseTime = allMetrics.length > 0 
      ? allMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / allMetrics.length 
      : 0;
    
    // Find worst performing endpoint (highest p95)
    let worstPerformingEndpoint: string | null = null;
    let worstP95 = 0;
    for (const metric of allMetrics) {
      if (metric.p95 > worstP95) {
        worstP95 = metric.p95;
        worstPerformingEndpoint = `${metric.method} ${metric.endpoint}`;
      }
    }
    
    return {
      totalEndpoints,
      healthyEndpoints,
      violatingEndpoints,
      totalViolations: violations.length,
      activeViolations: violations.filter(v => !v.resolved).length,
      averageResponseTime: Math.round(averageResponseTime),
      overallAvailability: Math.round(overallAvailability * 100) / 100,
      worstPerformingEndpoint
    };
  }

  /**
   * Update SLA threshold
   */
  async updateThreshold(threshold: SlaThreshold): Promise<void> {
    const key = this.getThresholdKey(threshold.endpoint, threshold.method);
    this.thresholds.set(key, threshold);
    
    // Store in Redis
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.hSet(`sla:threshold:${key}`, {
          endpoint: threshold.endpoint,
          method: threshold.method || '',
          maxResponseTimeMs: threshold.maxResponseTimeMs.toString(),
          maxErrorRate: threshold.maxErrorRate.toString(),
          minAvailability: threshold.minAvailability.toString(),
          enabled: threshold.enabled.toString()
        });
      }
    } catch (error) {
      logger.error('Failed to store SLA threshold:', error);
    }
    
    logger.info(`📊 SLA threshold updated: ${threshold.endpoint}`);
  }

  /**
   * Get all SLA thresholds
   */
  getAllThresholds(): SlaThreshold[] {
    return Array.from(this.thresholds.values());
  }

  /**
   * Start periodic cleanup of old metrics
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Start periodic aggregation and violation checking
   */
  private startAggregation(): void {
    this.aggregationInterval = setInterval(() => {
      this.checkSlaViolations();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Clean up old metrics (keep last 24 hours)
   */
  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    for (const [key, metrics] of this.metrics) {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      this.metrics.set(key, filtered);
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = null;
    }
    logger.info('📊 SLA monitoring stopped');
  }

  // Helper methods
  private getMetricKey(endpoint: string, method: string): string {
    return `${method}:${endpoint}`;
  }

  private parseMetricKey(key: string): [string, string] {
    const [method, ...endpointParts] = key.split(':');
    return [endpointParts.join(':'), method];
  }

  private getThresholdKey(endpoint: string, method?: string): string {
    return method ? `${method}:${endpoint}` : endpoint;
  }

  private parseThresholdKey(key: string): [string, string | undefined] {
    if (key.includes(':')) {
      const [method, ...endpointParts] = key.split(':');
      return [endpointParts.join(':'), method];
    }
    return [key, undefined];
  }
}

export const slaMonitor = new SlaMonitor();