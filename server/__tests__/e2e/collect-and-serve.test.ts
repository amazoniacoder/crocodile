/**
 * E2E: RSS collect → persist → GET /api/news
 *
 * Стратегия: мокируем только внешние I/O (db, Redis, NER, кластер, трейсинг),
 * реальный Express-роутер /api/news поднимается на supertest.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import newsRouter from '../../api/news/index';
import { ArticleManagementService } from '../../application/news/ArticleManagementService';

// ─── hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockDbSelect,
  mockDbInsert,
  mockDbUpdate,
  mockQueryCache,
  mockAdvancedCache,
  mockApiKeyAuth,
} = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockQueryCache: vi.fn((_req: any, _res: any, next: any) => next()),
  mockAdvancedCache: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  mockApiKeyAuth: vi.fn((_req: any, _res: any, next: any) => next()),
}));

vi.mock('../../db/db', () => ({
  db: { select: mockDbSelect, insert: mockDbInsert, update: mockDbUpdate },
  pool: { on: vi.fn() },
  checkDatabaseConnection: vi.fn().mockResolvedValue(true),
  logDatabaseConfig: vi.fn(),
}));

vi.mock('../../db/redis', () => ({
  getRedisClient: vi.fn().mockResolvedValue(null),
  closeRedisConnection: vi.fn().mockResolvedValue(undefined),
  checkRedisConnection: vi.fn().mockResolvedValue(false),
  isRedisEnabled: vi.fn().mockReturnValue(false),
}));

vi.mock('../../infrastructure/rss/RssParser', () => ({
  parseSourceFeed: vi.fn(),
}));

vi.mock('../../infrastructure/ner/GracefulNerService', () => ({
  gracefulNerService: { extractEntities: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../infrastructure/cluster/LoadBalancer', () => ({
  loadBalancer: {
    shouldHandleCollection: vi.fn().mockResolvedValue(true),
    releaseCollectionLock: vi.fn().mockResolvedValue(undefined),
    getClusterHealth: vi.fn().mockResolvedValue({ currentNode: 'test' }),
  },
}));

vi.mock('../../infrastructure/rss/RssRateLimiter', () => ({
  rssRateLimiter: {
    canMakeRequest: vi.fn().mockResolvedValue({ allowed: true }),
    recordRequest: vi.fn(),
    recordError: vi.fn(),
  },
}));

vi.mock('../../infrastructure/monitoring/MonitoringIntegrationService', () => ({
  cacheMiddlewares: {
    newsList: mockQueryCache,
    sources: mockQueryCache,
    newsSearch: mockQueryCache,
    popular: mockQueryCache,
  },
}));

vi.mock('../../middleware/advancedCache', () => ({
  advancedCache: mockAdvancedCache,
  invalidateCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../middleware/apiKeyAuth', () => ({
  apiKeyAuth: mockApiKeyAuth,
}));

vi.mock('../../infrastructure/events/EventBus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn() },
}));

vi.mock('../../infrastructure/persistence/NewsSourceRepository', () => ({
  newsSourceRepository: {
    findAllActive: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../infrastructure/persistence/NewsClusterRepository', () => ({
  newsClusterRepository: { findById: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../infrastructure/persistence/SourceConfigRepository', () => ({
  sourceConfigRepository: { get: vi.fn().mockResolvedValue('[]') },
}));

vi.mock('../../infrastructure/persistence/PageEventRepository', () => ({
  pageEventRepository: { getTopArticles: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../infrastructure/persistence/ArticleReactionRepository', () => ({
  articleReactionRepository: {
    getCountsBatch: vi.fn().mockResolvedValue(new Map()),
    getMyReactions: vi.fn().mockResolvedValue(new Map()),
    getTopByLikes: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../infrastructure/persistence/ArticleEmotionRepository', () => ({
  articleEmotionRepository: {
    getMyEmotions: vi.fn().mockResolvedValue(new Map()),
    getTotalsPerArticleBatch: vi.fn().mockResolvedValue(new Map()),
  },
}));

vi.mock('../../application/news/EntityClusterService', () => ({
  findSimilarArticles: vi.fn().mockResolvedValue({ similarArticles: [], otherArticles: [] }),
}));

vi.mock('../../infrastructure/monitoring/QueryCacheService', () => ({
  queryCacheService: { invalidateByTags: vi.fn() },
}));

vi.mock('../../middleware/sanitization', () => ({
  sanitizationMiddleware: (_req: any, _res: any, next: any) => next(),
  xssProtectionMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/cacheHeaders', () => ({
  setCacheHeaders: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/validation', () => ({
  validate: {
    query: () => (_req: any, _res: any, next: any) => next(),
    params: () => (_req: any, _res: any, next: any) => next(),
    body: () => (_req: any, _res: any, next: any) => next(),
  },
  schemas: { newsFilters: {}, articleId: {}, searchQuery: {}, reaction: {}, emotion: {} },
}));

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeArticleRow(id: number, title: string) {
  return {
    id,
    sourceId: 1,
    title,
    description: null,
    imageUrl: null,
    url: `https://example.com/${id}`,
    publishedAt: new Date('2025-01-01T12:00:00Z'),
    fetchedAt: new Date('2025-01-01T12:01:00Z'),
    region: 'russia',
    category: 'tech',
    clusterId: null,
    isArchived: false,
    createdAt: new Date('2025-01-01T12:01:00Z'),
    likesCount: 0,
    dislikesCount: 0,
    entities: null,
  };
}

function makeChainable(result: unknown) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  b.from = chain; b.where = chain; b.orderBy = chain; b.limit = chain; b.offset = chain;
  b.values = chain; b.onConflictDoNothing = chain; b.returning = () => Promise.resolve(result);
  b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  b.catch = (rej: (e: unknown) => unknown) => Promise.resolve(result).catch(rej);
  return b;
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('E2E: collect → persist → GET /api/news', () => {
  let app: express.Express;
  let storedArticles: ReturnType<typeof makeArticleRow>[];

  beforeEach(() => {
    vi.clearAllMocks();
    storedArticles = [];

    mockDbInsert.mockImplementation(() => {
      const b: Record<string, unknown> = {};
      b.values = () => b;
      b.onConflictDoNothing = () => b;
      b.returning = () => {
        const last = storedArticles[storedArticles.length - 1];
        return Promise.resolve(last ? [last] : []);
      };
      return b;
    });

    mockDbUpdate.mockImplementation(() => {
      const b: Record<string, unknown> = {};
      b.set = () => b;
      b.where = () => Promise.resolve({ rowCount: 0 });
      return b;
    });

    let selectCall = 0;
    mockDbSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall % 2 === 1) return makeChainable(storedArticles);
      return makeChainable([{ count: storedArticles.length }]);
    });

    app = express();
    app.use(express.json());
    app.use('/api/news', newsRouter);
  });

  it('GET /api/news возвращает пустой массив до сбора', async () => {
    const res = await request(app).get('/api/news');
    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it('после persist 3 статей GET /api/news возвращает 3 статьи', async () => {
    storedArticles.push(
      makeArticleRow(1, 'Статья 1'),
      makeArticleRow(2, 'Статья 2'),
      makeArticleRow(3, 'Статья 3'),
    );

    const res = await request(app).get('/api/news');
    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(3);
    expect(res.body.total).toBe(3);
  });

  it('повторный persist того же URL не создаёт дубли (ON CONFLICT DO NOTHING)', async () => {
    storedArticles.push(makeArticleRow(1, 'Статья 1'));

    mockDbInsert.mockImplementationOnce(() => {
      const b: Record<string, unknown> = {};
      b.values = () => b;
      b.onConflictDoNothing = () => b;
      b.returning = () => Promise.resolve([]);
      return b;
    });

    const svc = new ArticleManagementService();
    const result = await svc.persistArticles([{
      sourceId: 1,
      title: 'Статья 1',
      description: null,
      imageUrl: null,
      url: 'https://example.com/1',
      publishedAt: new Date('2025-01-01T12:00:00Z'),
      region: 'russia' as const,
      category: 'tech' as const,
    }]);

    expect(result.insertedCount).toBe(0);
    expect(result.duplicateCount).toBe(1);
  });

  it('GET /api/news поддерживает пагинацию (hasMore)', async () => {
    storedArticles.push(...Array.from({ length: 20 }, (_, i) => makeArticleRow(i + 1, `Статья ${i + 1}`)));

    let selectCall = 0;
    mockDbSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall % 2 === 1) return makeChainable(storedArticles);
      return makeChainable([{ count: 25 }]);
    });

    const res = await request(app).get('/api/news?page=1&limit=20');
    expect(res.status).toBe(200);
    expect(res.body.hasMore).toBe(true);
    expect(res.body.total).toBe(25);
  });
});
