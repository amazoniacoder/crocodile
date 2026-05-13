import { db } from '../../db/db';
import { adminAuditLog } from '@newsaggregator/shared/types/schema';
import { eq, desc, and, gte, lte, like, sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';

export interface AuditLogEntry {
  id: string;
  adminToken: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  oldValue?: any;
  newValue?: any;
  ipAddress: string;
  userAgent?: string | null;
  success: boolean;
  errorMessage?: string | null;
  timestamp: Date;
}

export interface AuditLogFilters {
  action?: string;
  resource?: string;
  adminToken?: string;
  success?: boolean;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

class AdminAuditLogRepository {
  async insert(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<AuditLogEntry> {
    try {
      const [inserted] = await db
        .insert(adminAuditLog)
        .values({
          ...entry,
          timestamp: new Date(),
        })
        .returning();
      
      return inserted as AuditLogEntry;
    } catch (error) {
      logger.error('Failed to insert audit log entry:', error);
      throw error;
    }
  }

  async findMany(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
    try {
      const conditions = [];
      
      if (filters.action) {
        conditions.push(like(adminAuditLog.action, `%${filters.action}%`));
      }
      
      if (filters.resource) {
        conditions.push(like(adminAuditLog.resource, `%${filters.resource}%`));
      }
      
      if (filters.adminToken) {
        conditions.push(eq(adminAuditLog.adminToken, filters.adminToken));
      }
      
      if (filters.success !== undefined) {
        conditions.push(eq(adminAuditLog.success, filters.success));
      }
      
      if (filters.fromDate) {
        conditions.push(gte(adminAuditLog.timestamp, filters.fromDate));
      }
      
      if (filters.toDate) {
        conditions.push(lte(adminAuditLog.timestamp, filters.toDate));
      }
      
      let query = db.select().from(adminAuditLog);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      query = query.orderBy(desc(adminAuditLog.timestamp)) as any;
      
      if (filters.limit) {
        query = query.limit(filters.limit) as any;
      }
      
      if (filters.offset) {
        query = query.offset(filters.offset) as any;
      }
      
      const results = await query;
      return results as AuditLogEntry[];
    } catch (error) {
      logger.error('Failed to fetch audit log entries:', error);
      throw error;
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
      // Total logs count
      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(adminAuditLog);
      
      const totalLogs = totalResult.count;
      
      // Success rate
      const [successResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(adminAuditLog)
        .where(eq(adminAuditLog.success, true));
      
      const successRate = totalLogs > 0 ? (successResult.count / totalLogs) * 100 : 0;
      
      // Top actions
      const topActionsResult = await db
        .select({
          action: adminAuditLog.action,
          count: sql<number>`count(*)`
        })
        .from(adminAuditLog)
        .groupBy(adminAuditLog.action)
        .orderBy(desc(sql`count(*)`))
        .limit(10);
      
      const topActions = topActionsResult.map(row => ({
        action: row.action,
        count: row.count
      }));
      
      // Top resources
      const topResourcesResult = await db
        .select({
          resource: adminAuditLog.resource,
          count: sql<number>`count(*)`
        })
        .from(adminAuditLog)
        .groupBy(adminAuditLog.resource)
        .orderBy(desc(sql`count(*)`))
        .limit(10);
      
      const topResources = topResourcesResult.map(row => ({
        resource: row.resource,
        count: row.count
      }));
      
      // Recent activity (last 24h)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [recentResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(adminAuditLog)
        .where(gte(adminAuditLog.timestamp, oneDayAgo));
      
      const recentActivity = recentResult.count;
      
      return {
        totalLogs,
        successRate: Math.round(successRate * 100) / 100,
        topActions,
        topResources,
        recentActivity
      };
    } catch (error) {
      logger.error('Failed to get audit log stats:', error);
      throw error;
    }
  }

  async cleanup(olderThanDays: number = 180): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      
      const result = await db
        .delete(adminAuditLog)
        .where(lte(adminAuditLog.timestamp, cutoffDate));
      
      logger.info(`Cleaned up ${result.rowCount || 0} old audit log entries`);
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to cleanup old audit log entries:', error);
      throw error;
    }
  }
}

export const adminAuditLogRepository = new AdminAuditLogRepository();