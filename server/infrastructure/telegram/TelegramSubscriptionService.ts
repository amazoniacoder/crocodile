import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { db } from '../../db/db';
import { telegramSubscriptions } from '../../../shared/types/schema';
import { eq } from 'drizzle-orm';
import { getRedisClient } from '../../db/redis';
import { logger } from '../../utils/logger';

export interface TelegramSubscription {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt?: Date;
  createdBy: string;
}

interface TokenValidationResult {
  isValid: boolean;
  subscriptionId?: string;
  name?: string;
  expiresAt?: Date;
  reason?: string;
}

const CACHE_TTL = 300; // 5 min
const KEY_PREFIX = 'tg_sub:';
const SALT_ROUNDS = 12;
const TOKEN_LENGTH = parseInt(process.env.TELEGRAM_TOKEN_LENGTH || '32', 10);
const DEFAULT_EXPIRY_DAYS = parseInt(process.env.TELEGRAM_DEFAULT_EXPIRY_DAYS || '30', 10);

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

class TelegramSubscriptionService {
  async generateToken(options: {
    name: string;
    expiresInDays?: number;
    createdBy?: string;
  }): Promise<{ token: string; id: string; expiresAt: Date }> {
    try {
      const token = `tg_${crypto.randomBytes(TOKEN_LENGTH).toString('hex')}`;
      const tokenHash = await bcrypt.hash(token, SALT_ROUNDS);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (options.expiresInDays || DEFAULT_EXPIRY_DAYS));

      const result = await db
        .insert(telegramSubscriptions)
        .values({
          id: crypto.randomUUID(),
          tokenHash,
          name: options.name,
          expiresAt,
          createdBy: options.createdBy || 'admin',
        })
        .returning({ id: telegramSubscriptions.id });

      const id = result[0].id;

      await this.cacheTokenHash(token, id, expiresAt);

      logger.info(`🔐 Generated Telegram subscription token: ${options.name} (expires: ${expiresAt.toISOString()})`);

      return { token, id, expiresAt };
    } catch (error) {
      logger.error('Failed to generate Telegram token:', error);
      throw new Error('Token generation failed');
    }
  }

  async validateToken(token: string): Promise<TokenValidationResult> {
    if (!token || !token.startsWith('tg_')) {
      return { isValid: false, reason: 'Invalid token format' };
    }

    try {
      const cached = await this.getCachedTokenValidation(token);
      if (cached) {
        await this.updateLastUsed(cached.subscriptionId!);
        return cached;
      }

      const subscriptions = await db
        .select()
        .from(telegramSubscriptions)
        .where(eq(telegramSubscriptions.isActive, true));

      for (const sub of subscriptions) {
        const isMatch = await bcrypt.compare(token, sub.tokenHash);
        if (isMatch) {
          const now = new Date();
          if (sub.expiresAt < now) {
            return { isValid: false, reason: 'Token expired' };
          }

          const result: TokenValidationResult = {
            isValid: true,
            subscriptionId: sub.id,
            name: sub.name,
            expiresAt: sub.expiresAt,
          };

          await this.cacheTokenValidation(token, result);
          await this.updateLastUsed(sub.id);

          return result;
        }
      }

      return { isValid: false, reason: 'Token not found' };
    } catch (error) {
      logger.error('Token validation error:', error);
      return { isValid: false, reason: 'Validation error' };
    }
  }

  async revokeToken(id: string): Promise<boolean> {
    try {
      const result = await db
        .update(telegramSubscriptions)
        .set({ isActive: false })
        .where(eq(telegramSubscriptions.id, id))
        .returning({ id: telegramSubscriptions.id });

      if (result.length > 0) {
        await this.clearTokenCache(id);
        logger.info(`🚫 Telegram subscription revoked: ${id}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Token revocation failed:', error);
      return false;
    }
  }

  async listActive(): Promise<TelegramSubscription[]> {
    try {
      const subscriptions = await db
        .select({
          id: telegramSubscriptions.id,
          name: telegramSubscriptions.name,
          isActive: telegramSubscriptions.isActive,
          createdAt: telegramSubscriptions.createdAt,
          expiresAt: telegramSubscriptions.expiresAt,
          lastUsedAt: telegramSubscriptions.lastUsedAt,
          createdBy: telegramSubscriptions.createdBy,
        })
        .from(telegramSubscriptions)
        .where(eq(telegramSubscriptions.isActive, true))
        .orderBy(telegramSubscriptions.createdAt);

      return subscriptions.map(sub => ({
        id: sub.id,
        name: sub.name,
        isActive: sub.isActive,
        createdAt: sub.createdAt,
        expiresAt: sub.expiresAt,
        lastUsedAt: sub.lastUsedAt || undefined,
        createdBy: sub.createdBy,
      }));
    } catch (error) {
      logger.error('Failed to list subscriptions:', error);
      return [];
    }
  }

  async listAll(): Promise<TelegramSubscription[]> {
    try {
      const subscriptions = await db
        .select({
          id: telegramSubscriptions.id,
          name: telegramSubscriptions.name,
          isActive: telegramSubscriptions.isActive,
          createdAt: telegramSubscriptions.createdAt,
          expiresAt: telegramSubscriptions.expiresAt,
          lastUsedAt: telegramSubscriptions.lastUsedAt,
          createdBy: telegramSubscriptions.createdBy,
        })
        .from(telegramSubscriptions)
        .orderBy(telegramSubscriptions.createdAt);

      return subscriptions.map(sub => ({
        id: sub.id,
        name: sub.name,
        isActive: sub.isActive,
        createdAt: sub.createdAt,
        expiresAt: sub.expiresAt,
        lastUsedAt: sub.lastUsedAt || undefined,
        createdBy: sub.createdBy,
      }));
    } catch (error) {
      logger.error('Failed to list all subscriptions:', error);
      return [];
    }
  }

  private async cacheTokenHash(token: string, id: string, expiresAt: Date): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (!redis) return;

      const cacheKey = `${KEY_PREFIX}${hashToken(token)}`;
      const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

      await redis.setEx(cacheKey, Math.min(ttl, CACHE_TTL), JSON.stringify({
        subscriptionId: id,
        expiresAt: expiresAt.toISOString(),
      }));
    } catch (error) {
      logger.error('Failed to cache token hash:', error);
    }
  }

  private async getCachedTokenValidation(token: string): Promise<TokenValidationResult | null> {
    try {
      const redis = await getRedisClient();
      if (!redis) return null;

      const cacheKey = `${KEY_PREFIX}${hashToken(token)}`;
      const cached = await redis.get(cacheKey);

      if (cached) {
        const data = JSON.parse(cached);
        const expiresAt = new Date(data.expiresAt);
        
        if (expiresAt < new Date()) {
          return { isValid: false, reason: 'Token expired' };
        }

        return {
          isValid: true,
          subscriptionId: data.subscriptionId,
          expiresAt,
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

      const cacheKey = `${KEY_PREFIX}${hashToken(token)}`;
      const ttl = Math.floor((validation.expiresAt.getTime() - Date.now()) / 1000);

      await redis.setEx(cacheKey, Math.min(ttl, CACHE_TTL), JSON.stringify(validation));
    } catch (error) {
      logger.error('Failed to cache token validation:', error);
    }
  }

  private async clearTokenCache(subscriptionId: string): Promise<void> {
    try {
      const redis = await getRedisClient();
      if (!redis) return;

      const keys = await redis.keys(`${KEY_PREFIX}*`);
      for (const key of keys) {
        const cached = await redis.get(key);
        if (cached) {
          const data = JSON.parse(cached);
          if (data.subscriptionId === subscriptionId) {
            await redis.del(key);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to clear token cache:', error);
    }
  }

  private async updateLastUsed(subscriptionId: string): Promise<void> {
    try {
      await db
        .update(telegramSubscriptions)
        .set({ lastUsedAt: new Date() })
        .where(eq(telegramSubscriptions.id, subscriptionId));
    } catch (error) {
      logger.error('Failed to update last used timestamp:', error);
    }
  }
}

export const telegramSubscriptionService = new TelegramSubscriptionService();
