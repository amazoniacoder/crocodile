import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { noCache } from '../../middleware/cacheHeaders';
import { pageEventRepository } from '../../infrastructure/persistence/PageEventRepository';
import { articleReactionRepository } from '../../infrastructure/persistence/ArticleReactionRepository';
import { queryCacheService } from '../../infrastructure/monitoring/QueryCacheService';
import { authenticateAdmin } from '../../middleware/security';

const router = Router();
router.use(authenticateAdmin);
router.use(noCache);

// GET /api/admin/analytics/summary?hours=24
router.get('/summary', asyncHandler(async (req, res) => {
  const hours = Math.min(168, parseInt(req.query.hours as string) || 24);
  const summary = await pageEventRepository.getSummary(hours);
  res.json({ hours, ...summary });
}));

// GET /api/admin/analytics/hourly?hours=24
router.get('/hourly', asyncHandler(async (req, res) => {
  const hours = Math.min(168, parseInt(req.query.hours as string) || 24);
  const data = await pageEventRepository.getByHour(hours);
  res.json({ hours, data });
}));

// GET /api/admin/analytics/daily?days=30
router.get('/daily', asyncHandler(async (req, res) => {
  const days = Math.min(90, parseInt(req.query.days as string) || 30);
  const data = await pageEventRepository.getUniqueByDay(days);
  res.json({ days, data });
}));

// GET /api/admin/analytics/peak?days=7
router.get('/peak', asyncHandler(async (req, res) => {
  const days = Math.min(30, parseInt(req.query.days as string) || 7);
  const data = await pageEventRepository.getPeakHours(days);
  res.json({ days, data });
}));

// GET /api/admin/analytics/top-articles?hours=24&limit=20
router.get('/top-articles', asyncHandler(async (req, res) => {
  const hours = Math.min(168, parseInt(req.query.hours as string) || 24);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const data = await pageEventRepository.getTopArticles(hours, limit);
  res.json({ hours, data });
}));

// GET /api/admin/analytics/top-sources?hours=24
router.get('/top-sources', asyncHandler(async (req, res) => {
  const hours = Math.min(168, parseInt(req.query.hours as string) || 24);
  const data = await pageEventRepository.getTopSources(hours);
  res.json({ hours, data });
}));

// GET /api/admin/analytics/reactions?hours=24
router.get('/reactions', asyncHandler(async (req, res) => {
  const hours = Math.min(168, parseInt(req.query.hours as string) || 24);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const [summary, top] = await Promise.all([
    articleReactionRepository.getSummary(hours),
    articleReactionRepository.getAdminCombinedTop(hours, limit),
  ]);
  res.json({ hours, ...summary, top });
}));

// DELETE /api/admin/analytics/reactions
router.delete('/reactions', asyncHandler(async (_req, res) => {
  const cleared = await articleReactionRepository.purgeAllReactionData();
  await queryCacheService.invalidateByTags(['news']);
  res.json({ ok: true, ...cleared });
}));

// DELETE /api/admin/analytics/clicks
router.delete('/clicks', asyncHandler(async (_req, res) => {
  const count = await pageEventRepository.deleteAllClicks();
  res.json({ ok: true, deletedRows: count });
}));

// DELETE /api/admin/analytics/all
router.delete('/all', asyncHandler(async (_req, res) => {
  const count = await pageEventRepository.deleteAll();
  res.json({ ok: true, deletedRows: count });
}));

// GET /api/admin/analytics/hot-entities?hours=24&limit=100&type=
router.get('/hot-entities', asyncHandler(async (req, res) => {
  const hours = Math.min(48, parseInt(req.query.hours as string) || 24);
  const limit = Math.min(200, parseInt(req.query.limit as string) || 100);
  const type  = (req.query.type as string) || 'all';

  const { db } = await import('../../db/db');
  const { hotEntities } = await import('../../../shared/types/schema');
  const { desc, gte, eq } = await import('drizzle-orm');

  const since = new Date(Date.now() - hours * 3_600_000);
  const conditions: any[] = [gte(hotEntities.periodStart, since)];
  if (type !== 'all') conditions.push(eq(hotEntities.entityType, type.toUpperCase()));

  const { and } = await import('drizzle-orm');
  const rows = await db
    .select()
    .from(hotEntities)
    .where(and(...conditions))
    .orderBy(desc(hotEntities.mentionCount))
    .limit(limit);

  res.json({ hours, total: rows.length, data: rows });
}));

// GET /api/admin/analytics/geography?hours=168
router.get('/geography', asyncHandler(async (req, res) => {
  const hours = Math.min(720, parseInt(req.query.hours as string) || 168);
  const data = await pageEventRepository.getGeography(hours);
  res.json({ hours, data });
}));

// GET /api/admin/analytics/article/:id?hours=168
router.get('/article/:id', asyncHandler(async (req, res) => {
  const articleId = parseInt(req.params.id);
  const hours = Math.min(720, parseInt(req.query.hours as string) || 168);
  const data = await pageEventRepository.getArticleAnalytics(articleId, hours);
  res.json({ articleId, hours, ...data });
}));

// GET /api/admin/analytics/pages?hours=24
router.get('/pages', asyncHandler(async (req, res) => {
  const hours = Math.min(168, parseInt(req.query.hours as string) || 24);
  const data = await pageEventRepository.getTopPages(hours);
  res.json({ hours, data });
}));

// GET /api/admin/analytics/devices?hours=24
router.get('/devices', asyncHandler(async (req, res) => {
  const hours = Math.min(168, parseInt(req.query.hours as string) || 24);
  const data = await pageEventRepository.getDevices(hours);
  res.json({ hours, data });
}));

// GET /api/admin/analytics/cities?hours=168&limit=20
router.get('/cities', asyncHandler(async (req, res) => {
  const hours = Math.min(720, parseInt(req.query.hours as string) || 168);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const data = await pageEventRepository.getTopCities(hours, limit);
  res.json({ hours, data });
}));

// GET /api/admin/analytics/cities/:countryCode?hours=168
router.get('/cities/:countryCode', asyncHandler(async (req, res) => {
  const countryCode = req.params.countryCode.toUpperCase();
  const hours = Math.min(720, parseInt(req.query.hours as string) || 168);
  const data = await pageEventRepository.getCitiesByCountry(countryCode, hours);
  res.json({ countryCode, hours, data });
}));

export default router;
