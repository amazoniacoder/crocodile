import { Request, Response, NextFunction } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { apiKeyService, ApiKeyInfo } from '../infrastructure/auth/ApiKeyService';
import { getRedisClient } from '../db/redis';
import { logger } from '../utils/logger';

declare module 'express-serve-static-core' {
  interface Request {
    apiKey?: ApiKeyInfo;
  }
}

// Анонимный лимит — достаточно для обычного пользователя
const anonymousLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  message: { error: 'Rate limit exceeded. Use an API key for higher limits.' },
});

// Кэш лимитеров по ключу (чтобы не создавать новый на каждый запрос)
const MAX_LIMITERS = parseInt(process.env.MAX_RATE_LIMITERS ?? '1000');
const keyedLimiters = new Map<string, RateLimitRequestHandler>();
let lruEvictions = 0;

function getKeyedLimiter(keyId: string, max: number): RateLimitRequestHandler {
  const cacheKey = `${keyId}:${max}`;
  if (!keyedLimiters.has(cacheKey)) {
    if (keyedLimiters.size >= MAX_LIMITERS) {
      const evicted = keyedLimiters.keys().next().value!;
      keyedLimiters.delete(evicted);
      lruEvictions++;
      logger.debug(`Rate limiter cache full, evicted ${evicted} (total evictions: ${lruEvictions})`);
    }
    keyedLimiters.set(
      cacheKey,
      rateLimit({
        windowMs: 60_000,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: () => keyId,
        message: { error: 'API key rate limit exceeded.' },
      }),
    );
  }
  return keyedLimiters.get(cacheKey)!;
}

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Localhost всегда пропускаем без rate limit
  const ip = req.ip ?? '';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return next();
  }

  const raw =
    (req.headers['x-api-key'] as string | undefined) ??
    (req.query.api_key as string | undefined);

  if (!raw) {
    return anonymousLimiter(req, res, next);
  }

  const info = await apiKeyService.validate(raw);
  if (!info) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  req.apiKey = info;
  return getKeyedLimiter(info.id, info.requestsPerMinute)(req, res, next);
}

/**
 * Get rate limiter statistics
 */
export function getRateLimiterStats() {
  return {
    activeLimiters: keyedLimiters.size,
    maxLimiters: MAX_LIMITERS,
    utilizationPercent: Math.round((keyedLimiters.size / MAX_LIMITERS) * 100),
    lruEvictions
  };
}
