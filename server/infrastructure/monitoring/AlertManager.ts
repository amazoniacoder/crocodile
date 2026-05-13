import { getRedisClient } from '../../db/redis';
import { logger } from '../../utils/logger';
import { webSocketManager } from '../cluster/WebSocketManager';
import { alertsTriggered } from './PrometheusMetrics';

interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: (metrics: SystemMetrics) => boolean;
  severity: 'info' | 'warning' | 'critical';
  cooldownMinutes: number;
  enabled: boolean;
  channels: AlertChannel[];
  metadata?: Record<string, any>;
}

interface SystemMetrics {
  // RSS Collection metrics
  lastCollectedAt: Date;
  articlesLast24h: number;
  errorRate: number;
  sourcesWithErrors: number;
  totalSources: number;
  
  // System metrics
  memoryUsage: number;
  cpuUsage: number;
  uptime: number;
  
  // Cluster metrics
  healthyNodes: number;
  totalNodes: number;
  failoverCount: number;
  
  // Rate limiting metrics
  backedOffDomains: number;
  domainsWithErrors: number;
  rateLimiterUtilization?: number;
  
  // Database metrics
  dbConnected: boolean;
  redisConnected: boolean;
  
  // Security metrics
  sslExpiryDays?: number;
  sslDomain?: string;
  sslIssuer?: string;
  diskUsagePercent?: number;
  diskUsageGB?: number;
  diskTotalGB?: number;
  fail2banRunning?: boolean;
  fail2banBansLast24h?: number;
  fail2banActiveJails?: number;
}

interface AlertChannel {
  type: 'email' | 'webhook' | 'websocket' | 'log';
  config: Record<string, any>;
  enabled: boolean;
}

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertRule['severity'];
  message: string;
  details: Record<string, any>;
  triggeredAt: Date;
  resolvedAt?: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

interface AlertHistory {
  ruleId: string;
  lastTriggered: Date;
  triggerCount: number;
  lastResolved?: Date;
}

export class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private alertHistory: Map<string, AlertHistory> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 30000; // 30 seconds

  constructor() {
    this.initializeDefaultRules();
    this.startMonitoring();
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'rss-collection-stalled',
        name: 'RSS Collection Stalled',
        description: 'RSS collection has not run for more than 30 minutes',
        condition: (metrics) => {
          const timeSinceLastCollection = Date.now() - metrics.lastCollectedAt.getTime();
          return timeSinceLastCollection > 30 * 60 * 1000; // 30 minutes
        },
        severity: 'critical',
        cooldownMinutes: 15,
        enabled: true,
        channels: [
          { type: 'websocket', config: {}, enabled: true },
          { type: 'log', config: {}, enabled: true }
        ]
      },
      {
        id: 'high-error-rate',
        name: 'High RSS Error Rate',
        description: 'More than 50% of RSS sources are experiencing errors',
        condition: (metrics) => {
          if (metrics.totalSources === 0) return false;
          const errorRate = metrics.sourcesWithErrors / metrics.totalSources;
          return errorRate > 0.5;
        },
        severity: 'warning',
        cooldownMinutes: 10,
        enabled: true,
        channels: [
          { type: 'websocket', config: {}, enabled: true },
          { type: 'log', config: {}, enabled: true }
        ]
      },
      {
        id: 'low-article-count',
        name: 'Low Article Collection',
        description: 'Less than 100 articles collected in the last 24 hours',
        condition: (metrics) => metrics.articlesLast24h < 100,
        severity: 'warning',
        cooldownMinutes: 60,
        enabled: true,
        channels: [
          { type: 'websocket', config: {}, enabled: true },
          { type: 'log', config: {}, enabled: true }
        ]
      },
      {
        id: 'high-memory-usage',
        name: 'High Memory Usage',
        description: 'Memory usage exceeds 1GB',
        condition: (metrics) => metrics.memoryUsage > 1024,
        severity: 'warning',
        cooldownMinutes: 5,
        enabled: true,
        channels: [
          { type: 'websocket', config: {}, enabled: true },
          { type: 'log', config: {}, enabled: true }
        ]
      },
      {
        id: 'database-disconnected',
        name: 'Database Connection Lost',
        description: 'Database connection is not available',
        condition: (metrics) => !metrics.dbConnected,
        severity: 'critical',
        cooldownMinutes: 1,
        enabled: true,
        channels: [
          { type: 'websocket', config: {}, enabled: true },
          { type: 'log', config: {}, enabled: true }
        ]
      },
      {
        id: 'cluster-unhealthy',
        name: 'Cluster Health Degraded',
        description: 'Less than 50% of cluster nodes are healthy',
        condition: (metrics) => {
          if (metrics.totalNodes === 0) return false;
          const healthyRatio = metrics.healthyNodes / metrics.totalNodes;
          return healthyRatio < 0.5;
        },
        severity: 'critical',
        cooldownMinutes: 5,
        enabled: true,
        channels: [
          { type: 'websocket', config: {}, enabled: true },
          { type: 'log', config: {}, enabled: true }
        ]
      },
      {
        id: 'frequent-failovers',
        name: 'Frequent Failovers',
        description: 'More than 3 failovers in the last hour',
        condition: (metrics) => metrics.failoverCount > 3,
        severity: 'warning',
        cooldownMinutes: 30,
        enabled: true,
        channels: [
          { type: 'websocket', config: {}, enabled: true },
          { type: 'log', config: {}, enabled: true }
        ]
      },
      {
        id: 'rate-limit-issues',
        name: 'Rate Limiting Issues',
        description: 'Multiple domains are backed off due to rate limiting',
        condition: (metrics) => metrics.backedOffDomains > 2,
        severity: 'warning',
        cooldownMinutes: 15,
        enabled: true,
        channels: [
          { type: 'websocket', config: {}, enabled: true },
          { type: 'log', config: {}, enabled: true }
        ]
      },
      {
        id: 'database-critical',
        name: 'Database Critical',
        description: 'Database is in critical state',
        condition: (metrics) => !metrics.dbConnected,
        severity: 'critical',
        cooldownMinutes: 5,
        enabled: true,
        channels: [
          { type: 'websocket', config: {}, enabled: true },
          { type: 'log', config: {}, enabled: true }
        ],
        metadata: { source: 'health_monitoring' }
      },
      {
        id: 'redis-unavailable',
        name: 'Redis Unavailable',
        description: 'Redis cache is unavailable',
        condition: (metrics) => !metrics.redisConnected,
        severity: 'critical',
        cooldownMinutes: 10,
        enabled: true,
        channels: [
          { type: 'websocket', config: {}, enabled: true },
          { type: 'log', config: {}, enabled: true }
        ],
        metadata: { source: 'health_monitoring' }
      },
      {
        id: 'rate-limiter-high-utilization',
        name: 'Rate Limiter High Utilization',
        description: 'Rate limiter cache utilization exceeds 80%',
        condition: (metrics) => {
          if (!metrics.rateLimiterUtilization) return false;
          return metrics.rateLimiterUtilization > 80;
        },
        severity: 'warning',
        cooldownMinutes: 30,
        enabled: true,
        channels: [
          { type: 'websocket', config: {}, enabled: true },
          { type: 'log', config: {}, enabled: true }
        ],
        metadata: { source: 'rate_limiting' }
      },
      {
        id: 'fail2ban-high-bans',
        name: 'Fail2Ban High Ban Rate',
        description: 'High number of IP bans detected',
        condition: (metrics) => {
          if (!metrics.fail2banBansLast24h) return false;
          return metrics.fail2banBansLast24h > 50;
        },
        severity: 'warning',
        cooldownMinutes: 60,
        enabled: true,
        channels: [
          { type: 'websocket', config: {}, enabled: true },
          { type: 'log', config: {}, enabled: true }
        ]
      },
      {
        id: 'fail2ban-service-down',
        name: 'Fail2Ban Service Down',
        description: 'Fail2Ban service is not running',
        condition: (metrics) => {
          return metrics.fail2banRunning === false;
        },
        severity: 'critical',
        cooldownMinutes: 30,
        enabled: true,
        channels: [
          { type: 'websocket', config: {}, enabled: true },
          { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL }, enabled: !!process.env.ALERT_WEBHOOK_URL },
          { type: 'log', config: {}, enabled: true }
        ]
      },
      {
        id: 'ssl-certificate-expiring',
        name: 'SSL Certificate Expiring',
        description: 'SSL certificate expires within 30 days',
        condition: (metrics) => {
          if (!metrics.sslExpiryDays) return false;
          return metrics.sslExpiryDays <= 30;
        },
        severity: 'warning',
        cooldownMinutes: 1440, // 24 hours
        enabled: true,
        channels: [
          { type: 'websocket', config: {}, enabled: true },
          { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL }, enabled: !!process.env.ALERT_WEBHOOK_URL },
          { type: 'log', config: {}, enabled: true }
        ]
      },
      {
        id: 'ssl-certificate-critical',
        name: 'SSL Certificate Critical',
        description: 'SSL certificate expires within 7 days',
        condition: (metrics) => {
          if (!metrics.sslExpiryDays) return false;
          return metrics.sslExpiryDays <= 7;
        },
        severity: 'critical',
        cooldownMinutes: 360, // 6 hours
        enabled: true,
        channels: [
          { type: 'websocket', config: {}, enabled: true },
          { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL }, enabled: !!process.env.ALERT_WEBHOOK_URL },
          { type: 'log', config: {}, enabled: true }
        ]
      },
      {
        id: 'disk-space-warning',
        name: 'Disk Space Warning',
        description: 'Disk usage exceeds 80%',
        condition: (metrics) => {
          if (!metrics.diskUsagePercent) return false;
          return metrics.diskUsagePercent > 80;
        },
        severity: 'warning',
        cooldownMinutes: 60,
        enabled: true,
        channels: [
          { type: 'websocket', config: {}, enabled: true },
          { type: 'log', config: {}, enabled: true }
        ]
      },
      {
        id: 'disk-space-critical',
        name: 'Disk Space Critical',
        description: 'Disk usage exceeds 90%',
        condition: (metrics) => {
          if (!metrics.diskUsagePercent) return false;
          return metrics.diskUsagePercent > 90;
        },
        severity: 'critical',
        cooldownMinutes: 30,
        enabled: true,
        channels: [
          { type: 'websocket', config: {}, enabled: true },
          { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL }, enabled: !!process.env.ALERT_WEBHOOK_URL },
          { type: 'log', config: {}, enabled: true }
        ]
      }
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }

    logger.info(`🚨 Initialized ${defaultRules.length} default alert rules`);
  }

  /**
   * Start monitoring and checking alert conditions
   */
  private startMonitoring(): void {
    this.checkInterval = setInterval(() => {
      this.checkAlertConditions();
    }, this.CHECK_INTERVAL_MS);

    logger.info('🚨 Alert monitoring started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info('🚨 Alert monitoring stopped');
  }

  /**
   * Check all alert conditions
   */
  private async checkAlertConditions(): Promise<void> {
    try {
      const metrics = await this.collectSystemMetrics();
      
      for (const rule of this.rules.values()) {
        if (!rule.enabled) continue;
        
        await this.evaluateRule(rule, metrics);
      }
    } catch (error) {
      logger.error('Error checking alert conditions:', error);
    }
  }

  /**
   * Collect current system metrics
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const metrics: SystemMetrics = {
      lastCollectedAt: new Date(0),
      articlesLast24h: 0,
      errorRate: 0,
      sourcesWithErrors: 0,
      totalSources: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      uptime: process.uptime(),
      healthyNodes: 1,
      totalNodes: 1,
      failoverCount: 0,
      backedOffDomains: 0,
      domainsWithErrors: 0,
      dbConnected: true,
      redisConnected: true
    };

    try {
      // RSS Collection metrics
      const { collectNewsUseCase } = await import('../../application/news/CollectNewsUseCase');
      if (collectNewsUseCase.lastCycleAt) {
        metrics.lastCollectedAt = collectNewsUseCase.lastCycleAt;
      }

      // System metrics
      const memUsage = process.memoryUsage();
      metrics.memoryUsage = memUsage.rss / (1024 * 1024); // MB
      
      // CPU usage (simplified)
      const cpuUsage = process.cpuUsage();
      metrics.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000 / metrics.uptime;

      // Database connectivity
      try {
        const { db } = await import('../../db/db');
        await db.execute('SELECT 1');
        metrics.dbConnected = true;
      } catch {
        metrics.dbConnected = false;
      }

      // Redis connectivity
      try {
        const redis = await getRedisClient();
        if (redis) {
          await redis.ping();
          metrics.redisConnected = true;
        } else {
          metrics.redisConnected = false;
        }
      } catch {
        metrics.redisConnected = false;
      }

      // Cluster metrics (if available)
      try {
        const { healthCheckManager } = await import('../cluster/HealthCheckManager');
        const clusterHealth = await healthCheckManager.getClusterHealth();
        metrics.healthyNodes = clusterHealth.healthyNodes;
        metrics.totalNodes = clusterHealth.totalNodes;
        
        const failoverHistory = healthCheckManager.getFailoverHistory();
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        metrics.failoverCount = failoverHistory.filter(f => f.timestamp > oneHourAgo).length;
      } catch {
        // Cluster components not available
      }

      // Rate limiting metrics (if available)
      try {
        const { rssRateLimiter } = await import('../rss/RssRateLimiter');
        const rateLimitStats = await rssRateLimiter.getAllStats();
        metrics.backedOffDomains = rateLimitStats.filter(s => s.isBackedOff).length;
        metrics.domainsWithErrors = rateLimitStats.filter(s => s.consecutiveErrors > 0).length;
        
        // Rate limiter cache utilization
        const { getRateLimiterStats } = await import('../../middleware/apiKeyAuth');
        const limiterStats = getRateLimiterStats();
        metrics.rateLimiterUtilization = limiterStats.utilizationPercent;
      } catch {
        // Rate limiter not available
      }

      // SSL Certificate metrics
      try {
        const domain = process.env.DOMAIN || 'localhost';
        if (domain !== 'localhost') {
          const sslInfo = await this.checkSSLCertificate(domain);
          metrics.sslExpiryDays = sslInfo.daysUntilExpiry;
          metrics.sslDomain = sslInfo.domain;
          metrics.sslIssuer = sslInfo.issuer;
        }
      } catch (error) {
        logger.debug('SSL check failed:', error);
      }

      // Disk usage metrics
      try {
        const { execSync } = require('child_process');
        const dfOutput = execSync('df / --output=pcent,used,size', { encoding: 'utf8' });
        const lines = dfOutput.trim().split('\n');
        if (lines.length > 1) {
          const [percent, used, total] = lines[1].trim().split(/\s+/);
          metrics.diskUsagePercent = parseInt(percent.replace('%', ''));
          metrics.diskUsageGB = Math.round(parseInt(used) / 1024 / 1024);
          metrics.diskTotalGB = Math.round(parseInt(total) / 1024 / 1024);
        }
      } catch (error) {
        logger.debug('Disk usage check failed:', error);
      }

      // Fail2Ban metrics
      try {
        const { execSync } = require('child_process');
        
        // Check if Fail2Ban is running
        try {
          execSync('systemctl is-active fail2ban', { stdio: 'ignore' });
          metrics.fail2banRunning = true;
          
          // Get ban statistics
          const statusOutput = execSync('fail2ban-client status', { encoding: 'utf8' });
          const jailMatch = statusOutput.match(/Jail list:\s*(.+)/);
          if (jailMatch) {
            const jails = jailMatch[1].split(',').map((j: string) => j.trim()).filter((j: string) => j);
            metrics.fail2banActiveJails = jails.length;
          }
          
          // Count bans in last 24h from journal
          try {
            const journalOutput = execSync('journalctl -u fail2ban --since "24 hours ago" | grep "Ban " | wc -l', { encoding: 'utf8' });
            metrics.fail2banBansLast24h = parseInt(journalOutput.trim()) || 0;
          } catch {
            metrics.fail2banBansLast24h = 0;
          }
        } catch {
          metrics.fail2banRunning = false;
        }
      } catch (error) {
        logger.debug('Fail2Ban check failed:', error);
        metrics.fail2banRunning = false;
      }

    } catch (error) {
      logger.error('Error collecting system metrics:', error);
    }

    return metrics;
  }

  /**
   * Check SSL certificate expiry
   */
  private async checkSSLCertificate(domain: string): Promise<{
    daysUntilExpiry: number;
    domain: string;
    issuer: string;
  }> {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const options = {
        hostname: domain,
        port: 443,
        method: 'GET',
        timeout: 5000,
        rejectUnauthorized: false
      };

      const req = https.request(options, (res: any) => {
        const cert = res.socket.getPeerCertificate();
        
        if (!cert || !cert.valid_to) {
          reject(new Error('No certificate found'));
          return;
        }

        const expiryDate = new Date(cert.valid_to);
        const now = new Date();
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        resolve({
          daysUntilExpiry,
          domain: cert.subject?.CN || domain,
          issuer: cert.issuer?.CN || 'Unknown'
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('SSL check timeout')));
      req.end();
    });
  }

  /**
   * Evaluate a single alert rule
   */
  private async evaluateRule(rule: AlertRule, metrics: SystemMetrics): Promise<void> {
    const ruleHistory = this.alertHistory.get(rule.id);
    const now = new Date();

    try {
      const conditionMet = rule.condition(metrics);
      const existingAlert = this.activeAlerts.get(rule.id);

      if (conditionMet && !existingAlert) {
        // Check cooldown period
        if (ruleHistory && ruleHistory.lastTriggered) {
          const timeSinceLastTrigger = now.getTime() - ruleHistory.lastTriggered.getTime();
          const cooldownMs = rule.cooldownMinutes * 60 * 1000;
          
          if (timeSinceLastTrigger < cooldownMs) {
            return; // Still in cooldown
          }
        }

        // Trigger new alert
        await this.triggerAlert(rule, metrics);
        
      } else if (!conditionMet && existingAlert && !existingAlert.resolvedAt) {
        // Resolve existing alert
        await this.resolveAlert(rule.id);
      }
    } catch (error) {
      logger.error(`Error evaluating rule ${rule.id}:`, error);
    }
  }

  /**
   * Trigger a new alert
   */
  private async triggerAlert(rule: AlertRule, metrics: SystemMetrics): Promise<void> {
    const alertId = `${rule.id}-${Date.now()}`;
    const now = new Date();

    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: this.generateAlertMessage(rule, metrics),
      details: { metrics, rule: { id: rule.id, description: rule.description } },
      triggeredAt: now,
      acknowledged: false
    };

    // Store alert
    this.activeAlerts.set(rule.id, alert);
    
    // Update history
    const history = this.alertHistory.get(rule.id) || {
      ruleId: rule.id,
      lastTriggered: now,
      triggerCount: 0
    };
    history.lastTriggered = now;
    history.triggerCount++;
    this.alertHistory.set(rule.id, history);

    // Store in Redis for persistence
    await this.storeAlert(alert);

    // Prometheus метрика
    alertsTriggered.inc({
      rule_id: rule.id,
      severity: rule.severity
    });

    // Send notifications
    await this.sendNotifications(alert, rule);

    logger.warn(`🚨 Alert triggered: ${rule.name} (${rule.severity})`, {
      alertId,
      ruleId: rule.id,
      message: alert.message
    });
  }

  /**
   * Resolve an active alert
   */
  private async resolveAlert(ruleId: string): Promise<void> {
    const alert = this.activeAlerts.get(ruleId);
    if (!alert) return;

    const now = new Date();
    alert.resolvedAt = now;

    // Update history
    const history = this.alertHistory.get(ruleId);
    if (history) {
      history.lastResolved = now;
      this.alertHistory.set(ruleId, history);
    }

    // Update in Redis
    await this.storeAlert(alert);

    // Remove from active alerts
    this.activeAlerts.delete(ruleId);

    // Send resolution notification
    await this.sendResolutionNotification(alert);

    logger.info(`✅ Alert resolved: ${alert.ruleName}`, {
      alertId: alert.id,
      ruleId: alert.ruleId,
      duration: now.getTime() - alert.triggeredAt.getTime()
    });
  }

  /**
   * Generate alert message based on rule and metrics
   */
  private generateAlertMessage(rule: AlertRule, metrics: SystemMetrics): string {
    switch (rule.id) {
      case 'rss-collection-stalled':
        const minutesSinceCollection = Math.floor((Date.now() - metrics.lastCollectedAt.getTime()) / 60000);
        return `RSS collection has been stalled for ${minutesSinceCollection} minutes`;
      
      case 'high-error-rate':
        const errorPercentage = Math.round(metrics.errorRate * 100);
        return `${errorPercentage}% of RSS sources (${metrics.sourcesWithErrors}/${metrics.totalSources}) are experiencing errors`;
      
      case 'low-article-count':
        return `Only ${metrics.articlesLast24h} articles collected in the last 24 hours (expected: >100)`;
      
      case 'high-memory-usage':
        return `Memory usage is at ${metrics.memoryUsage.toFixed(0)}MB`;
      
      case 'database-disconnected':
        return 'Database connection is not available';
      
      case 'cluster-unhealthy':
        return `Only ${metrics.healthyNodes}/${metrics.totalNodes} cluster nodes are healthy`;
      
      case 'frequent-failovers':
        return `${metrics.failoverCount} failovers occurred in the last hour`;
      
      case 'rate-limit-issues':
        return `${metrics.backedOffDomains} domains are backed off due to rate limiting`;
      
      case 'database-critical':
        return 'Database connection is not available';
      
      case 'redis-unavailable':
        return 'Redis cache is unavailable';
      
      case 'rate-limiter-high-utilization':
        return `Rate limiter cache utilization is at ${metrics.rateLimiterUtilization}%`;
      
      case 'ssl-certificate-expiring':
        return `SSL certificate for ${metrics.sslDomain} expires in ${metrics.sslExpiryDays} days (issued by ${metrics.sslIssuer})`;

      case 'ssl-certificate-critical':
        return `SSL certificate for ${metrics.sslDomain} expires in ${metrics.sslExpiryDays} days! Immediate renewal required.`;

      case 'disk-space-warning':
        return `Disk usage is at ${metrics.diskUsagePercent}% (${metrics.diskUsageGB}GB / ${metrics.diskTotalGB}GB)`;

      case 'disk-space-critical':
        return `CRITICAL: Disk usage is at ${metrics.diskUsagePercent}% (${metrics.diskUsageGB}GB / ${metrics.diskTotalGB}GB) - immediate action required!`;
      
      case 'fail2ban-high-bans':
        return `High ban rate detected: ${metrics.fail2banBansLast24h} IPs banned in last 24h (${metrics.fail2banActiveJails} active jails)`;

      case 'fail2ban-service-down':
        return `Fail2Ban service is not running - server vulnerable to brute force attacks!`;
      
      default:
        return rule.description;
    }
  }

  /**
   * Send notifications through configured channels
   */
  private async sendNotifications(alert: Alert, rule: AlertRule): Promise<void> {
    for (const channel of rule.channels) {
      if (!channel.enabled) continue;

      try {
        switch (channel.type) {
          case 'websocket':
            await this.sendWebSocketNotification(alert);
            break;
          case 'log':
            await this.sendLogNotification(alert);
            break;
          case 'webhook':
            await this.sendWebhookNotification(alert, channel.config);
            break;
          case 'email':
            await this.sendEmailNotification(alert, channel.config);
            break;
        }
      } catch (error) {
        logger.error(`Failed to send ${channel.type} notification for alert ${alert.id}:`, error);
      }
    }
  }

  /**
   * Send WebSocket notification
   */
  private async sendWebSocketNotification(alert: Alert): Promise<void> {
    try {
      await webSocketManager.broadcastToCluster({
        type: 'alert_triggered',
        data: {
          id: alert.id,
          ruleId: alert.ruleId,
          ruleName: alert.ruleName,
          severity: alert.severity,
          message: alert.message,
          triggeredAt: alert.triggeredAt.toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // WebSocket manager might not be available
      logger.debug('WebSocket notification failed:', error);
    }
  }

  /**
   * Send log notification
   */
  private async sendLogNotification(alert: Alert): Promise<void> {
    const logLevel = alert.severity === 'critical' ? 'error' : 'warn';
    logger[logLevel](`🚨 ALERT: ${alert.message}`, {
      alertId: alert.id,
      ruleId: alert.ruleId,
      severity: alert.severity
    });
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(alert: Alert, config: Record<string, any>): Promise<void> {
    if (!config.url) {
      logger.error('Webhook URL not configured for alert notification');
      return;
    }

    const payload = {
      alert: {
        id: alert.id,
        ruleId: alert.ruleId,
        ruleName: alert.ruleName,
        severity: alert.severity,
        message: alert.message,
        triggeredAt: alert.triggeredAt.toISOString()
      },
      system: 'NewsAggregator',
      timestamp: new Date().toISOString()
    };

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers || {})
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Send email notification (placeholder)
   */
  private async sendEmailNotification(alert: Alert, config: Record<string, any>): Promise<void> {
    // TODO: Implement email notification
    logger.info(`📧 Email notification would be sent for alert: ${alert.message}`);
  }

  /**
   * Send resolution notification
   */
  private async sendResolutionNotification(alert: Alert): Promise<void> {
    try {
      await webSocketManager.broadcastToCluster({
        type: 'alert_resolved',
        data: {
          id: alert.id,
          ruleId: alert.ruleId,
          ruleName: alert.ruleName,
          severity: alert.severity,
          resolvedAt: alert.resolvedAt!.toISOString(),
          duration: alert.resolvedAt!.getTime() - alert.triggeredAt.getTime()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.debug('WebSocket resolution notification failed:', error);
    }
  }

  /**
   * Store alert in Redis for persistence
   */
  private async storeAlert(alert: Alert): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (!redis) return;

      await redis.hSet(`alert:${alert.id}`, {
        id: alert.id,
        ruleId: alert.ruleId,
        ruleName: alert.ruleName,
        severity: alert.severity,
        message: alert.message,
        details: JSON.stringify(alert.details),
        triggeredAt: alert.triggeredAt.toISOString(),
        resolvedAt: alert.resolvedAt?.toISOString() || '',
        acknowledged: alert.acknowledged.toString(),
        acknowledgedBy: alert.acknowledgedBy || '',
        acknowledgedAt: alert.acknowledgedAt?.toISOString() || ''
      });

      await redis.expire(`alert:${alert.id}`, 7 * 24 * 60 * 60); // 7 days TTL

      // Add to active alerts list if not resolved
      if (!alert.resolvedAt) {
        await redis.sAdd('alerts:active', alert.id);
      } else {
        await redis.sRem('alerts:active', alert.id);
      }

      // Add to history
      await redis.lPush('alerts:history', alert.id);
      await redis.lTrim('alerts:history', 0, 999); // Keep last 1000 alerts

    } catch (error) {
      logger.error('Failed to store alert in Redis:', error);
    }
  }

  /**
   * Get all active alerts
   */
  async getActiveAlerts(): Promise<Alert[]> {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  async getAlertHistory(limit: number = 50): Promise<Alert[]> {
    try {
      const redis = await getRedisClient();
      if (!redis) return [];

      const alertIds = await redis.lRange('alerts:history', 0, limit - 1);
      const alerts: Alert[] = [];

      for (const alertId of alertIds) {
        const alertData = await redis.hGetAll(`alert:${alertId}`);
        if (alertData.id) {
          alerts.push({
            id: alertData.id,
            ruleId: alertData.ruleId,
            ruleName: alertData.ruleName,
            severity: alertData.severity as Alert['severity'],
            message: alertData.message,
            details: JSON.parse(alertData.details || '{}'),
            triggeredAt: new Date(alertData.triggeredAt),
            resolvedAt: alertData.resolvedAt ? new Date(alertData.resolvedAt) : undefined,
            acknowledged: alertData.acknowledged === 'true',
            acknowledgedBy: alertData.acknowledgedBy || undefined,
            acknowledgedAt: alertData.acknowledgedAt ? new Date(alertData.acknowledgedAt) : undefined
          });
        }
      }

      return alerts;
    } catch (error) {
      logger.error('Failed to get alert history:', error);
      return [];
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    // Find alert by ID in active alerts
    let alert: Alert | undefined;
    for (const activeAlert of this.activeAlerts.values()) {
      if (activeAlert.id === alertId) {
        alert = activeAlert;
        break;
      }
    }
    
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    await this.storeAlert(alert);

    logger.info(`✅ Alert acknowledged: ${alert.ruleName} by ${acknowledgedBy}`);
    return true;
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(): Promise<{
    activeAlerts: number;
    criticalAlerts: number;
    warningAlerts: number;
    alertsLast24h: number;
    mostTriggeredRule: string | null;
    averageResolutionTime: number;
  }> {
    const activeAlerts = Array.from(this.activeAlerts.values());
    const history = await this.getAlertHistory(100);
    
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const alertsLast24h = history.filter(a => a.triggeredAt > last24h);
    
    // Calculate most triggered rule
    const ruleCounts = new Map<string, number>();
    for (const alert of history) {
      ruleCounts.set(alert.ruleId, (ruleCounts.get(alert.ruleId) || 0) + 1);
    }
    
    let mostTriggeredRule: string | null = null;
    let maxCount = 0;
    for (const [ruleId, count] of ruleCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostTriggeredRule = ruleId;
      }
    }
    
    // Calculate average resolution time
    const resolvedAlerts = history.filter(a => a.resolvedAt);
    const averageResolutionTime = resolvedAlerts.length > 0
      ? resolvedAlerts.reduce((sum, a) => sum + (a.resolvedAt!.getTime() - a.triggeredAt.getTime()), 0) / resolvedAlerts.length
      : 0;

    return {
      activeAlerts: activeAlerts.length,
      criticalAlerts: activeAlerts.filter(a => a.severity === 'critical').length,
      warningAlerts: activeAlerts.filter(a => a.severity === 'warning').length,
      alertsLast24h: alertsLast24h.length,
      mostTriggeredRule,
      averageResolutionTime: Math.round(averageResolutionTime / 1000) // seconds
    };
  }

  /**
   * Get all alert rules
   */
  getAllRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Enable/disable alert rule
   */
  async toggleRule(ruleId: string, enabled: boolean): Promise<boolean> {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    rule.enabled = enabled;
    
    logger.info(`🔄 Alert rule ${enabled ? 'enabled' : 'disabled'}: ${rule.name}`);
    return true;
  }
}

export const alertManager = new AlertManager();