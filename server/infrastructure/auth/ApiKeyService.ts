import crypto from 'crypto';
import { db } from '../../db/db';
import { apiKeys } from '../../../shared/types/schema';
import { eq } from 'drizzle-orm';
import { getRedisClient } from '../../db/redis';
import { logger } from '../../utils/logger';

export interface ApiKeyInfo {
  id: string;
  name: string;
  requestsPerMinute: number;
  requestsPerDay: number;
}

const CACHE_TTL = 300; // 5 min
const KEY_PREFIX = 'apikey:';

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

class ApiKeyService {
  async validate(key: string): Promise<ApiKeyInfo | null> {
    const hash = hashKey(key);

    // Redis cache
    const redis = await getRedisClient();
    if (redis) {
      const cached = await redis.get(`${KEY_PREFIX}${hash}`).catch(() => null);
      if (cached === 'invalid') return null;
      if (cached) {
        this.touchLastUsed(hash).catch(() => {});
        return JSON.parse(cached) as ApiKeyInfo;
      }
    }

    const rows = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, hash))
      .limit(1);

    const row = rows[0];
    if (!row || !row.isActive) {
      if (redis) await redis.setEx(`${KEY_PREFIX}${hash}`, CACHE_TTL, 'invalid').catch(() => {});
      return null;
    }

    const info: ApiKeyInfo = {
      id: row.id,
      name: row.name,
      requestsPerMinute: row.requestsPerMinute,
      requestsPerDay: row.requestsPerDay,
    };

    if (redis) await redis.setEx(`${KEY_PREFIX}${hash}`, CACHE_TTL, JSON.stringify(info)).catch(() => {});
    this.touchLastUsed(hash).catch(() => {});
    return info;
  }

  private async touchLastUsed(hash: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.keyHash, hash));
  }

  async create(name: string, options?: { requestsPerMinute?: number; requestsPerDay?: number }): Promise<{ key: string; id: string }> {
    const key = `na_${crypto.randomBytes(24).toString('hex')}`;
    const hash = hashKey(key);

    const result = await db
      .insert(apiKeys)
      .values({
        id: crypto.randomUUID(),
        keyHash: hash,
        name,
        requestsPerMinute: options?.requestsPerMinute ?? 60,
        requestsPerDay: options?.requestsPerDay ?? 10000,
      })
      .returning({ id: apiKeys.id });

    logger.info(`🔑 API key created: ${name}`);
    return { key, id: result[0].id };
  }

  async revoke(id: string): Promise<boolean> {
    const result = await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(eq(apiKeys.id, id))
      .returning({ keyHash: apiKeys.keyHash });

    if (!result[0]) return false;

    const redis = await getRedisClient();
    if (redis) await redis.del(`${KEY_PREFIX}${result[0].keyHash}`).catch(() => {});
    logger.info(`🔑 API key revoked: ${id}`);
    return true;
  }

  async list() {
    return db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        isActive: apiKeys.isActive,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
        requestsPerMinute: apiKeys.requestsPerMinute,
        requestsPerDay: apiKeys.requestsPerDay,
      })
      .from(apiKeys)
      .orderBy(apiKeys.createdAt);
  }
}

export const apiKeyService = new ApiKeyService();
