import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../../db/redis';
import { logger } from '../../utils/logger';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const COMPRESSED_PREFIX = 'gz:';

export interface QueryCacheOptions {
  ttl: number;
  keyPrefix?: string;
  skipCache?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
  varyBy?: string[];
  tags?: string[];
  compression?: boolean;
  staleWhileRevalidate?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  errors: number;
  hitRate: number;
  totalRequests: number;
}

/**
 * Улучшенная система кэширования запросов
 * 
 * Особенности:
 * - Поддержка тегов для группового инвалидирования
 * - Stale-while-revalidate для лучшей производительности
 * - Сжатие больших ответов
 * - Детальная статистика
 * - Graceful degradation при недоступности Redis
 */
export class QueryCacheService {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    errors: 0,
    hitRate: 0,
    totalRequests: 0
  };

  private memoryCache = new Map<string, {
    data: any;
    expires: number;
    tags: string[];
  }>();

  private readonly maxMemoryCacheSize = 1000;
  private readonly compressionThreshold = 1024; // 1KB

  /**
   * Создает middleware для кэширования запросов
   */
  createCacheMiddleware(options: QueryCacheOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Проверяем, нужно ли пропустить кэш
      if (options.skipCache && options.skipCache(req)) {
        return next();
      }

      const cacheKey = this.generateCacheKey(req, options);
      
      try {
        // Пытаемся получить из кэша
        const cachedData = await this.get(cacheKey);
        
        if (cachedData) {
          this.stats.hits++;
          this.updateHitRate();
          
          // Устанавливаем заголовки кэша
          res.setHeader('X-Cache', 'HIT');
          res.setHeader('X-Cache-Key', cacheKey);
          
          // Проверяем stale-while-revalidate
          if (options.staleWhileRevalidate && this.isStale(cachedData, options.staleWhileRevalidate)) {
            res.setHeader('X-Cache-Status', 'STALE');
            // Инвалидируем stale-запись — следующий запрос получит свежие данные
            setImmediate(() => this.revalidateInBackground(cacheKey));
          } else {
            res.setHeader('X-Cache-Status', 'FRESH');
          }
          
          return res.json(cachedData.data);
        }

        this.stats.misses++;
        this.updateHitRate();

        // Перехватываем res.json для кэширования ответа
        const originalJson = res.json.bind(res);
        res.json = (data: any) => {
          // Кэшируем ответ асинхронно
          setImmediate(() => {
            this.set(cacheKey, data, options.ttl, options.tags || [])
              .catch(error => logger.warn('Failed to cache response:', error));
          });
          
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('X-Cache-Key', cacheKey);
          return originalJson(data);
        };

        next();

      } catch (error) {
        this.stats.errors++;
        logger.warn('Cache middleware error:', error);
        
        // Продолжаем без кэша при ошибке
        res.setHeader('X-Cache', 'ERROR');
        next();
      }
    };
  }

  /**
   * Получает данные из кэша
   */
  async get(key: string): Promise<{ data: any; timestamp: number; tags: string[] } | null> {
    this.stats.totalRequests++;

    try {
      // Сначала пробуем Redis
      const redisClient = await getRedisClient();
      if (redisClient) {
        const cached = await redisClient.get(key);
        if (cached) {
          const raw = cached.startsWith(COMPRESSED_PREFIX)
            ? (await gunzipAsync(Buffer.from(cached.slice(COMPRESSED_PREFIX.length), 'base64'))).toString('utf8')
            : cached;
          return JSON.parse(raw);
        }
      }

      // Fallback к memory cache
      const memoryCached = this.memoryCache.get(key);
      if (memoryCached && memoryCached.expires > Date.now()) {
        return {
          data: memoryCached.data,
          timestamp: Date.now(),
          tags: memoryCached.tags
        };
      }

      return null;

    } catch (error) {
      this.stats.errors++;
      logger.warn('Cache get error:', error);
      return null;
    }
  }

  /**
   * Сохраняет данные в кэш
   */
  async set(key: string, data: any, ttlSeconds: number, tags: string[] = []): Promise<void> {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        tags
      };

      const serialized = JSON.stringify(cacheData);

      // Сжимаем большие ответы
      let finalData: string;
      if (serialized.length > this.compressionThreshold) {
        const compressed = await gzipAsync(Buffer.from(serialized, 'utf8'));
        finalData = COMPRESSED_PREFIX + compressed.toString('base64');
      } else {
        finalData = serialized;
      }

      // Сохраняем в Redis
      const redisClient = await getRedisClient();
      if (redisClient) {
        await redisClient.setEx(key, ttlSeconds, finalData);
        
        // Сохраняем теги для группового инвалидирования
        if (tags.length > 0) {
          const pipeline = redisClient.multi();
          for (const tag of tags) {
            pipeline.sAdd(`cache:tag:${tag}`, key);
            pipeline.expire(`cache:tag:${tag}`, ttlSeconds + 3600); // Теги живут дольше
          }
          await pipeline.exec();
        }
      }

      // Сохраняем в memory cache как fallback
      this.setMemoryCache(key, data, ttlSeconds, tags);
      
      this.stats.sets++;

    } catch (error) {
      this.stats.errors++;
      logger.warn('Cache set error:', error);
    }
  }

  /**
   * Инвалидирует кэш по тегам
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidatedCount = 0;

    try {
      const redisClient = await getRedisClient();
      if (redisClient) {
        const pipeline = redisClient.multi();
        const keysToDelete: string[] = [];

        // Собираем все ключи по тегам
        for (const tag of tags) {
          const keys = await redisClient.sMembers(`cache:tag:${tag}`);
          keysToDelete.push(...keys);
          pipeline.del(`cache:tag:${tag}`);
        }

        // Удаляем ключи
        if (keysToDelete.length > 0) {
          pipeline.del(keysToDelete);
          invalidatedCount = keysToDelete.length;
        }

        await pipeline.exec();
      }

      // Инвалидируем memory cache
      for (const [key, cached] of this.memoryCache.entries()) {
        if (cached.tags.some(tag => tags.includes(tag))) {
          this.memoryCache.delete(key);
          invalidatedCount++;
        }
      }

      logger.info(`🗑️ Invalidated ${invalidatedCount} cache entries for tags: ${tags.join(', ')}`);
      return invalidatedCount;

    } catch (error) {
      this.stats.errors++;
      logger.error('Cache invalidation error:', error);
      return 0;
    }
  }

  /**
   * Инвалидирует кэш по паттерну ключей
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    let invalidatedCount = 0;

    try {
      const redisClient = await getRedisClient();
      if (redisClient) {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(keys);
          invalidatedCount = keys.length;
        }
      }

      // Инвалидируем memory cache
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
          invalidatedCount++;
        }
      }

      logger.info(`🗑️ Invalidated ${invalidatedCount} cache entries for pattern: ${pattern}`);
      return invalidatedCount;

    } catch (error) {
      this.stats.errors++;
      logger.error('Cache pattern invalidation error:', error);
      return 0;
    }
  }

  /**
   * Генерирует ключ кэша
   */
  private generateCacheKey(req: Request, options: QueryCacheOptions): string {
    if (options.keyGenerator) {
      return options.keyGenerator(req);
    }

    const prefix = options.keyPrefix || 'query';
    const path = req.path;
    
    // Включаем параметры запроса
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (value !== undefined && value !== null) {
        queryParams.set(key, String(value));
      }
    }
    
    // Включаем дополнительные параметры
    if (options.varyBy) {
      for (const header of options.varyBy) {
        const headerValue = req.headers[header.toLowerCase()];
        if (headerValue) {
          queryParams.set(`header:${header}`, String(headerValue));
        }
      }
    }

    const queryString = queryParams.toString();
    return `${prefix}:${path}${queryString ? ':' + queryString : ''}`;
  }

  /**
   * Проверяет, устарели ли данные для stale-while-revalidate
   */
  private isStale(cachedData: { timestamp: number }, staleSeconds: number): boolean {
    const age = (Date.now() - cachedData.timestamp) / 1000;
    return age > staleSeconds;
  }

  /**
   * Инвалидирует stale-запись, чтобы следующий запрос получил свежие данные (cache-aside).
   * Вызов next() на уже отправленном response некорректен, поэтому просто удаляем ключ.
   */
  private async revalidateInBackground(
    cacheKey: string
  ): Promise<void> {
    try {
      const redisClient = await getRedisClient();
      if (redisClient) {
        await redisClient.del(cacheKey);
      }
      this.memoryCache.delete(cacheKey);
    } catch (error) {
      logger.warn('Background revalidation error:', error);
    }
  }

  /**
   * Сохраняет в memory cache
   */
  private setMemoryCache(key: string, data: any, ttlSeconds: number, tags: string[]): void {
    // Очищаем старые записи если превышен лимит
    if (this.memoryCache.size >= this.maxMemoryCacheSize) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }

    this.memoryCache.set(key, {
      data,
      expires: Date.now() + (ttlSeconds * 1000),
      tags
    });
  }

  /**
   * Обновляет hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Получает статистику кэша
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Сбрасывает статистику
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      errors: 0,
      hitRate: 0,
      totalRequests: 0
    };
  }

  /**
   * Очищает весь кэш
   */
  async clear(): Promise<void> {
    try {
      const redisClient = await getRedisClient();
      if (redisClient) {
        await redisClient.flushDb();
      }
      this.memoryCache.clear();
      logger.info('🗑️ Cache cleared');
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }

  /**
   * Получает информацию о кэше
   */
  async getInfo(): Promise<{
    redisAvailable: boolean;
    memoryCacheSize: number;
    stats: CacheStats;
  }> {
    const redisClient = await getRedisClient();
    return {
      redisAvailable: !!redisClient,
      memoryCacheSize: this.memoryCache.size,
      stats: this.getStats()
    };
  }
}

// Singleton instance
export const queryCacheService = new QueryCacheService();

/**
 * Готовые middleware для часто используемых случаев
 */
export const cacheMiddlewares = {
  // Кэш для списка новостей (5 минут)
  newsList: queryCacheService.createCacheMiddleware({
    ttl: 300,
    keyPrefix: 'news:list',
    tags: ['news'],
    varyBy: ['x-browser-id'],
    staleWhileRevalidate: 60
  }),

  // Кэш для поиска (2 минуты)
  newsSearch: queryCacheService.createCacheMiddleware({
    ttl: 120,
    keyPrefix: 'news:search',
    tags: ['news', 'search'],
    skipCache: (req) => !req.query.q || String(req.query.q).length < 3
  }),

  // Кэш для источников (1 час)
  sources: queryCacheService.createCacheMiddleware({
    ttl: 3600,
    keyPrefix: 'news:sources',
    tags: ['sources']
  }),

  // Кэш для популярных статей (5 минут)
  popular: queryCacheService.createCacheMiddleware({
    ttl: 300,
    keyPrefix: 'news:popular',
    tags: ['news', 'popular']
  }),

  // Кэш для статистики (10 минут)
  stats: queryCacheService.createCacheMiddleware({
    ttl: 600,
    keyPrefix: 'admin:stats',
    tags: ['admin', 'stats']
  })
};