import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { advancedCache } from '../../middleware/advancedCache';
import { cacheMiddlewares } from '../../infrastructure/monitoring/MonitoringIntegrationService';
import { setCacheHeaders } from '../../middleware/cacheHeaders';
import { validate, schemas } from '../../middleware/validation';
import { sanitizationMiddleware, xssProtectionMiddleware } from '../../middleware/sanitization';
import { NotFoundError, BadRequestError } from '../../../shared/utils/errors';
import { newsArticleRepository } from '../../infrastructure/persistence/NewsArticleRepository';
import { newsSourceRepository } from '../../infrastructure/persistence/NewsSourceRepository';
import { newsClusterRepository } from '../../infrastructure/persistence/NewsClusterRepository';
import { sourceConfigRepository } from '../../infrastructure/persistence/SourceConfigRepository';
import { pageEventRepository } from '../../infrastructure/persistence/PageEventRepository';
import { articleReactionRepository } from '../../infrastructure/persistence/ArticleReactionRepository';
import { articleEmotionRepository } from '../../infrastructure/persistence/ArticleEmotionRepository';
import { isArticleEmotionId } from '../../../shared/constants/articleEmotions';
import type { Request as ExpressRequest } from 'express';
import rateLimit from 'express-rate-limit';
import type { NewsDetailResponse } from '../../../shared/types/news';
import { findSimilarArticles } from '../../application/news/EntityClusterService';
import { apiKeyAuth } from '../../middleware/apiKeyAuth';

const reactLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });
import type { NewsListParams } from '../../../shared/types/news';

const router = Router();

// Применяем санитизацию и API-key auth ко всем роутам
router.use(sanitizationMiddleware);
router.use(xssProtectionMiddleware);
router.use(apiKeyAuth);

async function visitorDailyHash(req: ExpressRequest): Promise<{ browserId: string; dailyHash: string }> {
  const { createHash } = await import('crypto');
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '';
  const browserId = (req.headers['x-browser-id'] as string) ?? '';
  const date = new Date().toISOString().slice(0, 10);
  const dailyHash = createHash('sha256').update(`${ip}${browserId}${date}`).digest('hex').slice(0, 16);
  return { browserId, dailyHash };
}

const parseBool = (v: unknown): boolean | undefined => {
  if (v == null) return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true;
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false;
  return undefined;
};

const parseIntSafe = (v: unknown): number | undefined => {
  if (v == null) return undefined;
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : undefined;
};

type DonateMethod = {
  title: string;
  value: string;
  note?: string;
  href?: string;
};

// ─── GET /api/news ───────────────────────────────────────────────────────────

router.get('/',
  validate.query(schemas.newsFilters),
  setCacheHeaders({ public: true, maxAge: 60 }),
  (req, res, next) => {
    // sourceType=telegram — не кэшируем через newsList (разные данные)
    if (req.query.sourceType) return next();
    return cacheMiddlewares.newsList(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const params: NewsListParams = {
      region: req.query.region as any,
      category: req.query.category
        ? (Array.isArray(req.query.category)
            ? req.query.category as any
            : [req.query.category as string])
        : undefined,
      city: req.query.city as string | undefined,
      date: req.query.date as string,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      tzOffsetMinutes: parseIntSafe(req.query.tzOffsetMinutes),
      page: Math.max(1, parseInt(req.query.page as string) || 1),
      limit: Math.min(100, parseInt(req.query.limit as string) || 20),
      enabledRussia: parseBool(req.query.enabledRussia),
      enabledWorld: parseBool(req.query.enabledWorld),
      enabledCities: parseBool(req.query.enabledCities),
      sourceIds: req.query.sourceIds
        ? String(req.query.sourceIds).split(',').map(Number).filter(n => Number.isFinite(n) && n > 0)
        : undefined,
    };

    const sourceType = req.query.sourceType as 'rss' | 'telegram' | undefined;
    const channelUsername = req.query.channelUsername as string | undefined;

    const { articles, total } = await newsArticleRepository.findMany(
      {
        region: params.region,
        category: params.category,
        city: params.city,
        date: params.date,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        tzOffsetMinutes: params.tzOffsetMinutes,
        enabledRussia: params.enabledRussia,
        enabledWorld: params.enabledWorld,
        enabledCities: params.enabledCities,
        sourceIds: params.sourceIds,
        sourceType,
        channelUsername,
      },
      params.page!,
      params.limit!
    );

    const sourceIds = [...new Set(articles.map(a => a.sourceId).filter(Boolean))] as number[];
    const sourceMap = await newsArticleRepository.findSourceDisplay(sourceIds);

    const clusterIds = [...new Set(articles.map(a => a.clusterId).filter(Boolean))] as number[];
    const clusters = await Promise.all(clusterIds.map(id => newsClusterRepository.findById(id)));
    const clusterMap = new Map(clusters.filter(Boolean).map(c => [c!.id, c!]));

    const result = articles.map(a => {
      const src = a.sourceId != null ? sourceMap.get(a.sourceId) : undefined;
      return {
        ...a,
        sourceName: src?.name ?? 'Unknown',
        sourceCity: src?.city ?? null,
        sourceLogoUrl: src?.logoUrl ?? null,
        sourceChannelId: src?.channelId ?? null,
        cluster: a.clusterId ? clusterMap.get(a.clusterId) ?? null : null,
      };
    });

    res.json({
      articles: result,
      total,
      page: params.page,
      limit: params.limit,
      hasMore: (params.page! - 1) * params.limit! + articles.length < total
    });
  })
);

// ─── GET /api/news/sources ───────────────────────────────────────────────────

router.get('/cities',
  setCacheHeaders({ public: true, maxAge: 3600, etag: true }),
  advancedCache({ ttl: 3600, tags: ['news', 'cities'] }),
  asyncHandler(async (_req, res) => {
    const cities = await newsSourceRepository.getActiveCities();
    res.json({ cities });
  })
);

router.get('/sources',
  setCacheHeaders({ public: true, maxAge: 600, etag: true }),
  cacheMiddlewares.sources,
  asyncHandler(async (_req, res) => {
    const sources = await newsSourceRepository.findAllActive();
    res.json({ sources });
  })
);

// ─── GET /api/news/search ────────────────────────────────────────────────────

router.get('/search',
  validate.query(schemas.searchQuery),
  cacheMiddlewares.newsSearch,
  asyncHandler(async (req, res) => {
    const query = req.query.q as string;
    if (!query?.trim()) throw new BadRequestError('Search query is required');

    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const enabledRussia = parseBool(req.query.enabledRussia);
    const enabledWorld = parseBool(req.query.enabledWorld);
    const enabledCities = parseBool(req.query.enabledCities);

    const articles = await newsArticleRepository.search(query.trim(), limit, {
      enabledRussia,
      enabledWorld,
      enabledCities,
    });

    const sourceIds = [...new Set(articles.map(a => a.sourceId).filter(Boolean))] as number[];
    const sourceMap = await newsArticleRepository.findSourceDisplay(sourceIds);

    const withSources = articles.map(a => {
      const src = a.sourceId != null ? sourceMap.get(a.sourceId) : undefined;
      return {
        ...a,
        sourceName: src?.name ?? 'Unknown',
        sourceCity: src?.city ?? null,
      };
    });

    res.json({
      articles: withSources,
      total: withSources.length,
      query: query.trim(),
      limited: withSources.length === limit
    });
  })
);

// ─── GET /api/news/popular ─────────────────────────────────────────────────
// ─── GET /api/news/hot-entities ─────────────────────────────────────────────────────
router.get('/hot-entities',
  setCacheHeaders({ public: true, maxAge: 3600 }),
  advancedCache({ ttl: 3600, tags: ['news', 'hot-entities'], keyGenerator: (req) => `news:hot-entities:${req.query.type || 'all'}:${req.query.limit || 10}` }),
  asyncHandler(async (req, res) => {
    const type  = (req.query.type as string) || 'all';
    const limit = Math.min(50, parseInt(req.query.limit as string) || 10);
    const hours = Math.min(48, parseInt(req.query.hours as string) || 48);

    const { db } = await import('../../db/db');
    const { hotEntities } = await import('../../../shared/types/schema');
    const { desc, gte, eq, and } = await import('drizzle-orm');

    const since = new Date(Date.now() - hours * 3_600_000);
    const conditions: any[] = [gte(hotEntities.periodStart, since)];
    if (type !== 'all') conditions.push(eq(hotEntities.entityType, type.toUpperCase()));

    const rows = await db
      .select()
      .from(hotEntities)
      .where(and(...conditions))
      .orderBy(desc(hotEntities.mentionCount))
      .limit(limit);

    res.json({ type, total: rows.length, data: rows });
  })
);

// ─── GET /api/news/by-entity ──────────────────────────────────────────────────────
router.get('/by-entity',
  asyncHandler(async (req, res) => {
    const term = (req.query.term as string)?.trim();
    if (!term) throw new BadRequestError('term is required');
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const hours = Math.min(48, parseInt(req.query.hours as string) || 48);
    const since = new Date(Date.now() - hours * 3_600_000);

    const articles = await newsArticleRepository.findByEntities({
      terms: [term],
      minMatches: 1,
      since,
      excludeId: 0,
      limit,
    });

    const sourceIds = [...new Set(articles.map(a => a.sourceId).filter(Boolean))] as number[];
    const sourceMap = await newsArticleRepository.findSourceDisplay(sourceIds);
    const withSources = articles.map(a => ({
      ...a,
      sourceName: sourceMap.get(a.sourceId!)?.name ?? 'Unknown',
      sourceCity: sourceMap.get(a.sourceId!)?.city ?? null,
      publishedAt: a.publishedAt instanceof Date ? a.publishedAt.toISOString() : String(a.publishedAt),
      fetchedAt: a.fetchedAt instanceof Date ? a.fetchedAt.toISOString() : String(a.fetchedAt),
      createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
    }));

    res.json({ term, total: withSources.length, articles: withSources });
  })
);

// ─── GET /api/news/popular ──────────────────────────────────────────────────────
router.get('/popular',
  setCacheHeaders({ public: true, maxAge: 300 }),
  cacheMiddlewares.popular,
  asyncHandler(async (_req, res) => {
    const articles = await pageEventRepository.getTopArticles(24, 3);
    res.json({ articles });
  })
);

// ─── GET /api/news/top-liked ───────────────────────────────────────────────
router.get('/top-liked',
  setCacheHeaders({ public: true, maxAge: 300 }),
  advancedCache({ ttl: 300, tags: ['news', 'top-liked'], keyGenerator: () => 'news:top-liked' }),
  asyncHandler(async (_req, res) => {
    const articles = await articleReactionRepository.getTopByLikes(24, 3);
    res.json({ articles });
  })
);

// ─── GET /api/news/reaction-counts ─────────────────────────────────────────
// Без отдельных Cache-Control: дефолт для /api — no-store в routes.ts (см. там).
router.get('/reaction-counts',
  asyncHandler(async (req, res) => {
    const ids = req.query.ids
      ? String(req.query.ids).split(',').map(Number).filter(n => Number.isFinite(n) && n > 0)
      : [];
    if (!ids.length) { res.json({}); return; }

    const { dailyHash } = await visitorDailyHash(req);

    const countsMap = await articleReactionRepository.getCountsBatch(ids);
    // Привязка к посетителю — только daily_hash (в нём уже IP + browserId + день);
    // нельзя гейтить через truthy браузер — иначе myEmotion пропадает если заголовок пустой.
    const myReactions = await articleReactionRepository.getMyReactions(ids, dailyHash);
    const myEmotions = await articleEmotionRepository.getMyEmotions(ids, dailyHash);

    const emotionTotals = await articleEmotionRepository.getTotalsPerArticleBatch(ids);

    type Row = {
      likes: number;
      dislikes: number;
      myReaction: string | null;
      myEmotion: string | null;
      emotionCounts: Record<string, number>;
    };
    const result: Record<number, Row> = {};
    for (const id of ids) {
      result[id] = {
        ...(countsMap.get(id) ?? { likes: 0, dislikes: 0 }),
        myReaction: myReactions.get(id) ?? null,
        myEmotion: myEmotions.get(id) ?? null,
        emotionCounts: emotionTotals.get(id) ?? {},
      };
    }
    res.json(result);
  })
);

// ─── POST /api/news/:id/emotion ────────────────────────────────────────────

router.post('/:id/emotion', 
  validate.params(schemas.articleId),
  validate.body(schemas.emotion),
  reactLimiter, 
  asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) throw new BadRequestError('Invalid article ID');
  const emotionIdRaw = req.body?.emotionId;
  if (!isArticleEmotionId(emotionIdRaw)) throw new BadRequestError('Invalid emotion');

  const { dailyHash } = await visitorDailyHash(req);

  const emotionCounts = await articleEmotionRepository.upsertEmotion(id, emotionIdRaw, dailyHash);
  res.json({ ok: true, emotionCounts });
}));

// ─── POST /api/news/:id/react ───────────────────────────────────────────────
router.post('/:id/react', 
  validate.params(schemas.articleId),
  validate.body(schemas.reaction),
  reactLimiter, 
  asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) throw new BadRequestError('Invalid article ID');
  const { type } = req.body;
  if (type !== 'like' && type !== 'dislike') throw new BadRequestError('type must be like or dislike');

  const { dailyHash } = await visitorDailyHash(req);

  await articleReactionRepository.insert(id, type, dailyHash);
  if (type === 'like') {
    const { invalidateCache } = await import('../../middleware/advancedCache');
    await invalidateCache('news:top-liked');
  }
  const counts = await articleReactionRepository.getCounts(id);
  res.json({ ok: true, ...counts });
}));

// ─── GET /api/news/donate-config ─────────────────────────────────────────────
router.get('/donate-config',
  advancedCache({ ttl: 300, tags: ['news', 'donate'], keyGenerator: () => 'news:donate-config' }),
  asyncHandler(async (_req, res) => {
    const raw = await sourceConfigRepository.get('donate_methods_json');
    let methods: DonateMethod[] = [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        methods = parsed
          .filter((m) => typeof m === 'object' && m !== null)
          .map((m) => {
            const item = m as Record<string, unknown>;
            return {
              title: String(item.title ?? '').trim(),
              value: String(item.value ?? '').trim(),
              note: String(item.note ?? '').trim(),
              href: String(item.href ?? '').trim(),
            };
          })
          .filter((m) => m.title && m.value);
      }
    } catch {
      methods = [];
    }
    res.json({ methods });
  })
);

// ─── GET /api/news/clusters/:id ──────────────────────────────────────────────

router.get('/clusters/:id',
  setCacheHeaders({ public: true, maxAge: 300, etag: true }),
  advancedCache({
    ttl: 300,
    tags: ['news', 'clusters'],
    keyGenerator: (req) => `news:cluster:${req.params.id}`
  }),
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid cluster ID');

    const cluster = await newsClusterRepository.findById(id);
    if (!cluster) throw new NotFoundError('Cluster not found');

    const clusterArticles = await newsArticleRepository.findByClusterId(id);

    const sourceIds = [...new Set(clusterArticles.map(a => a.sourceId).filter(Boolean))] as number[];
    const sourceMap = await newsArticleRepository.findSourceDisplay(sourceIds);

    const withSources = clusterArticles.map(a => {
      const src = a.sourceId != null ? sourceMap.get(a.sourceId) : undefined;
      return {
        ...a,
        sourceName: src?.name ?? 'Unknown',
        sourceCity: src?.city ?? null,
      };
    });

    res.json({ cluster, articles: withSources });
  })
);

// ─── GET /api/news/:id ───────────────────────────────────────────────────────

router.get('/:id',
  validate.params(schemas.articleId),
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) throw new BadRequestError('Invalid article ID');

    const serialize = (
      a: any,
      src?: { name: string; city: string | null }
    ) => ({
      ...a,
      sourceName: src?.name ?? 'Unknown',
      sourceCity: src?.city ?? null,
      publishedAt: a.publishedAt instanceof Date ? a.publishedAt.toISOString() : String(a.publishedAt),
      fetchedAt: a.fetchedAt instanceof Date ? a.fetchedAt.toISOString() : String(a.fetchedAt),
      createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
    });

    const article = await newsArticleRepository.findById(id);
    if (!article) throw new NotFoundError('Article not found');

    const sourceMap = await newsArticleRepository.findSourceDisplay(article.sourceId ? [article.sourceId] : []);
    const src = article.sourceId != null ? sourceMap.get(article.sourceId) : undefined;
    const articleWithSource = serialize(article, src);

    // clusterSources — блок «Сравнить источники» (токенный кластер)
    let clusterSources: any[] = [];
    if (article.clusterId) {
      const clusterArticles = await newsArticleRepository.findByClusterIdLimited(article.clusterId, 50, article.id);
      if (clusterArticles.length) {
        const ids = [...new Set(clusterArticles.map(a => a.sourceId).filter(Boolean))] as number[];
        const map = await newsArticleRepository.findSourceDisplay(ids);
        clusterSources = clusterArticles.map(a => serialize(a, a.sourceId != null ? map.get(a.sourceId) : undefined));
      }
    }

    // similarArticles — блок «Похожие новости» + «Другие новости» (entity-движок)
    const { similarArticles: similar, otherArticles: other } = await findSimilarArticles(article as any);

    const allRelated = [...similar, ...other];
    const allIds = [...new Set(allRelated.map(a => a.sourceId).filter(Boolean))] as number[];
    const relatedSourceMap = await newsArticleRepository.findSourceDisplay(allIds);
    const serializeList = (list: any[]) =>
      list.map(a => serialize(a, a.sourceId != null ? relatedSourceMap.get(a.sourceId) : undefined));

    const payload: NewsDetailResponse = {
      article: articleWithSource,
      clusterSources,
      similarArticles: serializeList(similar),
      otherArticles: serializeList(other),
    };

    res.json(payload);
  })
);

export default router;
