import { logger } from '../../utils/logger';
import { adminAuditLogRepository, type AuditLogEntry } from '../persistence/AdminAuditLogRepository';
import { randomUUID } from 'node:crypto';

export interface AuditEvent {
  action: string;
  resource: string;
  resourceId?: string | number;
  adminToken?: string;
  userAgent?: string;
  ip?: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
}

class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private maxLogs = 1000; // Reduced since we have DB persistence

  async log(event: AuditEvent): Promise<void> {
    const entry: Omit<AuditLogEntry, 'timestamp'> = {
      id: this.generateId(),
      adminToken: event.adminToken || 'unknown',
      action: event.action,
      resource: event.resource,
      resourceId: event.resourceId?.toString(),
      oldValue: event.oldValue,
      newValue: event.newValue,
      ipAddress: event.ip || 'unknown',
      userAgent: event.userAgent,
      success: event.success,
      errorMessage: event.errorMessage,
    };

    try {
      // Store in database
      const saved = await adminAuditLogRepository.insert(entry);
      
      // Keep recent entries in memory for quick access
      this.logs.unshift(saved);
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(0, this.maxLogs);
      }

      // Log to Winston for additional persistence
      const logLevel = event.success ? 'info' : 'warn';
      logger.log(logLevel, `AUDIT: ${event.action} on ${event.resource}`, {
        auditEvent: saved,
        category: 'audit',
      });
    } catch (error) {
      logger.error('Failed to log audit event:', error);
      // Fallback to memory-only storage
      this.logs.unshift({ ...entry, timestamp: new Date() } as AuditLogEntry);
    }
  }

  async getLogs(filters?: {
    action?: string;
    resource?: string;
    adminToken?: string;
    success?: boolean;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogEntry[]> {
    try {
      // Try to get from database first
      return await adminAuditLogRepository.findMany(filters);
    } catch (error) {
      logger.error('Failed to fetch audit logs from database, using memory fallback:', error);
      
      // Fallback to memory logs with basic filtering
      let filtered = [...this.logs];

      if (filters?.action) {
        filtered = filtered.filter(log => log.action.includes(filters.action!));
      }
      if (filters?.resource) {
        filtered = filtered.filter(log => log.resource.includes(filters.resource!));
      }
      if (filters?.adminToken) {
        filtered = filtered.filter(log => log.adminToken === filters.adminToken);
      }
      if (filters?.success !== undefined) {
        filtered = filtered.filter(log => log.success === filters.success);
      }
      if (filters?.fromDate) {
        filtered = filtered.filter(log => log.timestamp >= filters.fromDate!);
      }
      if (filters?.toDate) {
        filtered = filtered.filter(log => log.timestamp <= filters.toDate!);
      }

      const limit = filters?.limit || 100;
      const offset = filters?.offset || 0;
      return filtered.slice(offset, offset + limit);
    }
  }

  async getStats(): Promise<{
    totalLogs: number;
    successRate: number;
    topActions: Array<{ action: string; count: number }>;
    topResources: Array<{ resource: string; count: number }>;
    recentActivity: number; // last 24h
  }> {
    try {
      // Try to get from database first
      return await adminAuditLogRepository.getStats();
    } catch (error) {
      logger.error('Failed to fetch audit stats from database, using memory fallback:', error);
      
      // Fallback to memory stats
      const total = this.logs.length;
      const successful = this.logs.filter(log => log.success).length;
      const successRate = total > 0 ? (successful / total) * 100 : 0;

      const actionCounts = new Map<string, number>();
      const resourceCounts = new Map<string, number>();
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      let recentActivity = 0;

      for (const log of this.logs) {
        actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1);
        resourceCounts.set(log.resource, (resourceCounts.get(log.resource) || 0) + 1);
        
        if (log.timestamp >= oneDayAgo) {
          recentActivity++;
        }
      }

      const topActions = Array.from(actionCounts.entries())
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const topResources = Array.from(resourceCounts.entries())
        .map(([resource, count]) => ({ resource, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalLogs: total,
        successRate: Math.round(successRate * 100) / 100,
        topActions,
        topResources,
        recentActivity,
      };
    }
  }

  async cleanup(olderThanDays: number = 180): Promise<number> {
    try {
      return await adminAuditLogRepository.cleanup(olderThanDays);
    } catch (error) {
      logger.error('Failed to cleanup audit logs:', error);
      return 0;
    }
  }

  private generateId(): string {
    return randomUUID();
  }
}

export const auditLogger = new AuditLogger();

// Helper function for common admin actions
export function logAdminAction(
  action: string,
  resource: string,
  req: any,
  success: boolean = true,
  details?: { oldValue?: any; newValue?: any },
  errorMessage?: string
): void {
  auditLogger.log({
    action,
    resource,
    resourceId: req.params?.id,
    adminToken: req.headers?.authorization?.replace('Bearer ', '') || 'unknown',
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    oldValue: details?.oldValue,
    newValue: details?.newValue,
    success,
    errorMessage,
  });
}