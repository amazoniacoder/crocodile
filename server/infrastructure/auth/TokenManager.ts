import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { getRedisClient } from '../../db/redis';
import { db } from '../../db/db';
import { sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';

interface AdminToken {
  id: string;
  tokenHash: string;
  name: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt?: Date;
  isActive: boolean;
  createdBy: string;
  permissions: string[];
}

interface TokenValidationResult {
  isValid: boolean;
  tokenId?: string;
  name?: string;
  permissions?: string[];
  expiresAt?: Date;
  reason?: string;
}

interface TokenRotationResult {
  success: boolean;
  newToken?: string;
  tokenId?: string;
  expiresAt?: Date;
  error?: string;
}

export class TokenManager {
  private static instance: TokenManager;
  private readonly SALT_ROUNDS = 12;
  private readonly DEFAULT_EXPIRY_DAYS = 30;
  private readonly ROTATION_OVERLAP_HOURS = 24; // Grace period for old token
  private readonly TOKEN_LENGTH = 32; // bytes

  private constructor() {}

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Initialize token management system
   */
  async initialize(): Promise<void> {
    try {
      // Create admin_tokens table if it doesn't exist
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS admin_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          token_hash VARCHAR(255) NOT NULL UNIQUE,
          name VARCHAR(100) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          last_used_at TIMESTAMP WITH TIME ZONE,
          is_active BOOLEAN DEFAULT true,
          created_by VARCHAR(100) DEFAULT 'system',
          permissions JSONB DEFAULT '["admin"]'::jsonb,
          created_index SERIAL
        )
      `);

      // Create index for performance
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_admin_tokens_hash ON admin_tokens(token_hash);
        CREATE INDEX IF NOT EXISTS idx_admin_tokens_active ON admin_tokens(is_active, expires_at);
      `);

      // Migrate existing ADMIN_TOKEN if present
      await this.migrateExistingToken();

      // Start cleanup job
      this.startCleanupJob();

      logger.info('🔐 Token management system initialized');
    } catch (error) {
      logger.error('Failed to initialize token management:', error);
      throw error;
    }
  }

  /**
   * Generate a new admin token
   */
  async generateToken(options: {
    name: string;
    expiresInDays?: number;
    createdBy?: string;
    permissions?: string[];
  }): Promise<{ token: string; tokenId: string; expiresAt: Date }> {
    try {
      const token = crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
      const tokenHash = await bcrypt.hash(token, this.SALT_ROUNDS);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (options.expiresInDays || this.DEFAULT_EXPIRY_DAYS));

      const result = await db.execute(sql`
        INSERT INTO admin_tokens (token_hash, name, expires_at, created_by, permissions)
        VALUES (${tokenHash}, ${options.name}, ${expiresAt}, ${options.createdBy || 'system'}, ${JSON.stringify(options.permissions || ['admin'])})
        RETURNING id
      `);

      const tokenId = result.rows[0]?.id as string;

      // Cache token hash for faster validation
      await this.cacheTokenHash(token, tokenId, expiresAt);

      logger.info(`🔐 Generated new admin token: ${options.name} (expires: ${expiresAt.toISOString()})`);

      return {
        token,
        tokenId,
        expiresAt
      };
    } catch (error) {
      logger.error('Failed to generate token:', error);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Validate admin token
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    if (!token) {
      return { isValid: false, reason: 'No token provided' };
    }

    try {
      // Check cache first for performance
      const cached = await this.getCachedTokenValidation(token);
      if (cached) {
        await this.updateLastUsed(cached.tokenId!);
        return cached;
      }

      // Fallback to database
      const result = await db.execute(sql`
        SELECT id, token_hash, name, expires_at, permissions, is_active
        FROM admin_tokens
        WHERE is_active = true AND expires_at > NOW()
        ORDER BY created_at DESC
      `);

      for (const row of result.rows) {
        const isMatch = await bcrypt.compare(token, row.token_hash as string);
        if (isMatch) {
          const tokenData = {
            isValid: true,
            tokenId: row.id as string,
            name: row.name as string,
            permissions: row.permissions as string[],
            expiresAt: new Date(row.expires_at as string)
          };

          // Cache for future requests
          await this.cacheTokenValidation(token, tokenData);
          await this.updateLastUsed(row.id as string);

          return tokenData;
        }
      }

      return { isValid: false, reason: 'Invalid token' };
    } catch (error) {
      logger.error('Token validation error:', error);
      return { isValid: false, reason: 'Validation error' };
    }
  }

  /**
   * Rotate existing token (create new, keep old for grace period)
   */
  async rotateToken(currentToken: string, options: {
    name?: string;
    expiresInDays?: number;
    createdBy?: string;
  }): Promise<TokenRotationResult> {
    try {
      // Validate current token
      const validation = await this.validateToken(currentToken);
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Current token is invalid'
        };
      }

      // Generate new token
      const newTokenData = await this.generateToken({
        name: options.name || `Rotated from ${validation.name}`,
        expiresInDays: options.expiresInDays,
        createdBy: options.createdBy || 'rotation',
        permissions: validation.permissions
      });

      // Mark old token for deactivation after grace period
      const deactivateAt = new Date();
      deactivateAt.setHours(deactivateAt.getHours() + this.ROTATION_OVERLAP_HOURS);

      await db.execute(sql`
        UPDATE admin_tokens 
        SET expires_at = ${deactivateAt}
        WHERE id = ${validation.tokenId}
      `);

      // Clear cache for old token
      await this.clearTokenCache(currentToken);

      logger.info(`🔄 Token rotated: ${validation.name} -> ${newTokenData.tokenId}`, {
        oldTokenId: validation.tokenId,
        newTokenId: newTokenData.tokenId,
        graceUntil: deactivateAt.toISOString()
      });

      return {
        success: true,
        newToken: newTokenData.token,
        tokenId: newTokenData.tokenId,
        expiresAt: newTokenData.expiresAt
      };
    } catch (error) {
      logger.error('Token rotation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Rotation failed'
      };
    }
  }

  /**
   * Revoke token immediately
   */
  async revokeToken(tokenId: string, revokedBy: string): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        UPDATE admin_tokens 
        SET is_active = false, expires_at = NOW()
        WHERE id = ${tokenId}
      `);

      if (result.rowCount && result.rowCount > 0) {
        // Clear all caches for this token
        await this.clearAllCachesForToken(tokenId);
        
        logger.info(`🚫 Token revoked: ${tokenId} by ${revokedBy}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Token revocation failed:', error);
      return false;
    }
  }

  /**
   * Get all active tokens (for admin dashboard)
   */
  async getAllTokens(): Promise<Array<{
    id: string;
    name: string;
    createdAt: Date;
    expiresAt: Date;
    lastUsedAt?: Date;
    createdBy: string;
    permissions: string[];
    isExpiringSoon: boolean;
  }>> {
    try {
      const result = await db.execute(sql`
        SELECT id, name, created_at, expires_at, last_used_at, created_by, permissions
        FROM admin_tokens
        WHERE is_active = true
        ORDER BY created_at DESC
      `);

      const now = new Date();
      const soonThreshold = new Date();
      soonThreshold.setDate(soonThreshold.getDate() + 7); // 7 days

      return result.rows.map(row => ({
        id: row.id as string,
        name: row.name as string,
        createdAt: new Date(row.created_at as string),
        expiresAt: new Date(row.expires_at as string),
        lastUsedAt: row.last_used_at ? new Date(row.last_used_at as string) : undefined,
        createdBy: row.created_by as string,
        permissions: row.permissions as string[],
        isExpiringSoon: new Date(row.expires_at as string) < soonThreshold
      }));
    } catch (error) {
      logger.error('Failed to get tokens:', error);
      return [];
    }
  }

  /**
   * Get token usage statistics
   */
  async getTokenStats(): Promise<{
    totalTokens: number;
    activeTokens: number;
    expiredTokens: number;
    expiringSoon: number;
    lastRotation?: Date;
    oldestToken?: Date;
  }> {
    try {
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) as total_tokens,
          COUNT(CASE WHEN is_active = true AND expires_at > NOW() THEN 1 END) as active_tokens,
          COUNT(CASE WHEN is_active = false OR expires_at <= NOW() THEN 1 END) as expired_tokens,
          COUNT(CASE WHEN is_active = true AND expires_at > NOW() AND expires_at < NOW() + INTERVAL '7 days' THEN 1 END) as expiring_soon,
          MAX(CASE WHEN created_by = 'rotation' THEN created_at END) as last_rotation,
          MIN(CASE WHEN is_active = true THEN created_at END) as oldest_token
        FROM admin_tokens
      `);

      const row = result.rows[0];
      return {
        totalTokens: parseInt(row?.total_tokens as string) || 0,
        activeTokens: parseInt(row?.active_tokens as string) || 0,
        expiredTokens: parseInt(row?.expired_tokens as string) || 0,
        expiringSoon: parseInt(row?.expiring_soon as string) || 0,
        lastRotation: row?.last_rotation ? new Date(row.last_rotation as string) : undefined,
        oldestToken: row?.oldest_token ? new Date(row.oldest_token as string) : undefined
      };
    } catch (error) {
      logger.error('Failed to get token stats:', error);
      return {
        totalTokens: 0,
        activeTokens: 0,
        expiredTokens: 0,
        expiringSoon: 0
      };
    }
  }

  /**
   * Auto-rotate tokens that are expiring soon
   */
  async autoRotateExpiring(): Promise<void> {
    try {
      const soonThreshold = new Date();
      soonThreshold.setDate(soonThreshold.getDate() + 3); // 3 days before expiry

      const result = await db.execute(sql`
        SELECT id, name, token_hash, permissions
        FROM admin_tokens
        WHERE is_active = true 
          AND expires_at > NOW() 
          AND expires_at < ${soonThreshold}
          AND created_by != 'auto-rotation'
      `);

      for (const row of result.rows) {
        try {
          // Generate new token
          const newTokenData = await this.generateToken({
            name: `Auto-rotated: ${row.name}`,
            createdBy: 'auto-rotation',
            permissions: row.permissions as string[]
          });

          // Extend old token for grace period
          const graceUntil = new Date();
          graceUntil.setHours(graceUntil.getHours() + this.ROTATION_OVERLAP_HOURS);

          await db.execute(sql`
            UPDATE admin_tokens 
            SET expires_at = ${graceUntil}
            WHERE id = ${row.id}
          `);

          logger.warn(`🔄 Auto-rotated expiring token: ${row.name} -> ${newTokenData.tokenId}`, {
            oldTokenId: row.id,
            newToken: newTokenData.token.substring(0, 8) + '...',
            expiresAt: newTokenData.expiresAt.toISOString()
          });

        } catch (error) {
          logger.error(`Failed to auto-rotate token ${row.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Auto-rotation job failed:', error);
    }
  }

  // Private methods

  private async migrateExistingToken(): Promise<void> {
    const existingToken = process.env.ADMIN_TOKEN;
    if (!existingToken) return;

    try {
      // Check if we already have tokens
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM admin_tokens WHERE is_active = true`);
      const count = parseInt((result.rows[0]?.count as string) || '0');

      if (count === 0) {
        // Migrate existing token
        const tokenHash = await bcrypt.hash(existingToken, this.SALT_ROUNDS);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + this.DEFAULT_EXPIRY_DAYS);

        await db.execute(sql`
          INSERT INTO admin_tokens (token_hash, name, expires_at, created_by, permissions)
          VALUES (${tokenHash}, 'Migrated Legacy Token', ${expiresAt}, 'migration', '["admin"]')
        `);

        logger.info('🔄 Migrated existing ADMIN_TOKEN to token management system');
      }
    } catch (error) {
      logger.error('Token migration failed:', error);
    }
  }

  private async cacheTokenHash(token: string, tokenId: string, expiresAt: Date): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (!redis) return;

      const cacheKey = `token:${crypto.createHash('sha256').update(token).digest('hex')}`;
      const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

      await redis.setEx(cacheKey, ttl, JSON.stringify({
        tokenId,
        expiresAt: expiresAt.toISOString()
      }));
    } catch (error) {
      logger.error('Failed to cache token hash:', error);
    }
  }

  private async getCachedTokenValidation(token: string): Promise<TokenValidationResult | null> {
    try {
      const redis = await getRedisClient();
      if (!redis) return null;

      const cacheKey = `token:${crypto.createHash('sha256').update(token).digest('hex')}`;
      const cached = await redis.get(cacheKey);

      if (cached) {
        const data = JSON.parse(cached);
        return {
          isValid: true,
          tokenId: data.tokenId,
          expiresAt: new Date(data.expiresAt)
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to get cached token validation:', error);
      return null;
    }
  }

  private async cacheTokenValidation(token: string, validation: TokenValidationResult): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (!redis || !validation.expiresAt) return;

      const cacheKey = `token:${crypto.createHash('sha256').update(token).digest('hex')}`;
      const ttl = Math.floor((validation.expiresAt.getTime() - Date.now()) / 1000);

      await redis.setEx(cacheKey, Math.min(ttl, 3600), JSON.stringify(validation)); // Max 1 hour cache
    } catch (error) {
      logger.error('Failed to cache token validation:', error);
    }
  }

  private async clearTokenCache(token: string): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (!redis) return;

      const cacheKey = `token:${crypto.createHash('sha256').update(token).digest('hex')}`;
      await redis.del(cacheKey);
    } catch (error) {
      logger.error('Failed to clear token cache:', error);
    }
  }

  private async clearAllCachesForToken(tokenId: string): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (!redis) return;

      const keys = await redis.keys('token:*');
      for (const key of keys) {
        const cached = await redis.get(key);
        if (cached) {
          const data = JSON.parse(cached);
          if (data.tokenId === tokenId) {
            await redis.del(key);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to clear all caches for token:', error);
    }
  }

  private async updateLastUsed(tokenId: string): Promise<void> {
    try {
      await db.execute(sql`
        UPDATE admin_tokens 
        SET last_used_at = NOW() 
        WHERE id = ${tokenId}
      `);
    } catch (error) {
      logger.error('Failed to update last used timestamp:', error);
    }
  }

  private startCleanupJob(): void {
    // Run cleanup every 6 hours
    setInterval(async () => {
      try {
        // Remove expired tokens older than 7 days
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);

        const result = await db.execute(sql`
          DELETE FROM admin_tokens 
          WHERE (is_active = false OR expires_at < NOW()) 
            AND expires_at < ${cutoff}
        `);

        if (result.rowCount && result.rowCount > 0) {
          logger.info(`🧹 Cleaned up ${result.rowCount} expired tokens`);
        }

        // Auto-rotate expiring tokens
        await this.autoRotateExpiring();

      } catch (error) {
        logger.error('Token cleanup job failed:', error);
      }
    }, 6 * 60 * 60 * 1000); // 6 hours
  }
}

export const tokenManager = TokenManager.getInstance();