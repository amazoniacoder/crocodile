/**
 * advancedCache — thin wrapper над QueryCacheService.
 * Оставлен для обратной совместимости с роутами которые его используют.
 * Новый код должен использовать queryCacheService напрямую.
 */
import { Request, Response, NextFunction } from 'express';
import { queryCacheService } from '../infrastructure/monitoring/QueryCacheService';

interface CacheOptions {
  ttl: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request, res: Response) => boolean;
  tags?: string[];
}

export const advancedCache = (options: CacheOptions) => {
  return queryCacheService.createCacheMiddleware({
    ttl: options.ttl,
    tags: options.tags,
    keyGenerator: options.keyGenerator,
    skipCache: options.condition
      ? (req: Request) => !options.condition!(req, {} as Response)
      : undefined,
  });
};

/** Инвалидирует кэш по паттерну — делегирует в queryCacheService */
export const invalidateCache = async (pattern: string): Promise<void> => {
  await queryCacheService.invalidateByPattern(pattern);
};

/** Инвалидирует кэш по тегам — делегирует в queryCacheService */
export const invalidateByTags = async (tags: string[]): Promise<void> => {
  await queryCacheService.invalidateByTags(tags);
};
