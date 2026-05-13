import { userTokenRepository } from '../persistence/UserTokenRepository';
import { isTokenValid } from '../../domain/user/UserToken';
import { getRedisClient } from '../../db/redis';

const CACHE_TTL = 300; // 5 минут
const CACHE_PREFIX = 'user_token:';

interface ValidationResult {
  valid: boolean;
  tokenId?: number;
  isAdmin?: boolean;
  expiresAt?: Date | null;
}

const TOKEN_RE = /^ut_[0-9a-f]{64}$/;

export class UserTokenService {
  async validateToken(token: string): Promise<ValidationResult> {
    if (!token || !TOKEN_RE.test(token)) {
      return { valid: false };
    }

    const cacheKey = `${CACHE_PREFIX}${token}`;

    try {
      const client = await getRedisClient();
      if (client) {
        const cached = await client.get(cacheKey);
        if (cached) {
          const data = JSON.parse(cached);
          return {
            valid: data.valid,
            tokenId: data.tokenId,
            isAdmin: data.isAdmin ?? false,
            expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          };
        }
      }
    } catch {
      // игнорируем ошибки кэша
    }

    const userToken = await userTokenRepository.findByToken(token);

    if (!userToken) {
      try {
        const client = await getRedisClient();
        await client?.set(cacheKey, JSON.stringify({ valid: false }), { EX: 60 });
      } catch { /* игнорируем */ }
      return { valid: false };
    }

    const valid = isTokenValid(userToken);
    const result: ValidationResult = {
      valid,
      tokenId: userToken.id,
      isAdmin: userToken.isAdmin ?? false,
      expiresAt: userToken.expiresAt,
    };

    try {
      const client = await getRedisClient();
      await client?.set(cacheKey, JSON.stringify({
        valid,
        tokenId: userToken.id,
        isAdmin: userToken.isAdmin ?? false,
        expiresAt: userToken.expiresAt?.toISOString() ?? null,
      }), { EX: CACHE_TTL });
    } catch { /* игнорируем */ }

    if (valid) {
      userTokenRepository.updateLastUsed(userToken.id).catch(() => {});
    }

    return result;
  }

  async invalidateCache(token: string): Promise<void> {
    try {
      const client = await getRedisClient();
      if (client) await client.del(`${CACHE_PREFIX}${token}`);
    } catch { /* игнорируем */ }
  }
}

export const userTokenService = new UserTokenService();
