import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { noCache } from '../../middleware/cacheHeaders';
import { validate, schemas } from '../../middleware/validation';
import { sanitizationMiddleware } from '../../middleware/sanitization';
import { BadRequestError, NotFoundError } from '@newsaggregator/shared/utils';
import { NEWS_REGIONS, NEWS_CATEGORIES } from '@newsaggregator/shared/types/news';
import { newsSourceRepository } from '../../infrastructure/persistence/NewsSourceRepository';
import { logAdminAction } from '../../infrastructure/audit/AuditLogger';

const router = Router();

// ─── Auth ────────────────────────────────────────────────────────────────────

router.use(noCache);
router.use(sanitizationMiddleware);

// ─── GET /api/admin/news/sources ─────────────────────────────────────────────

router.get('/sources', asyncHandler(async (_req, res) => {
  const sources = await newsSourceRepository.findAll();
  res.json({ sources });
}));

// ─── POST /api/admin/news/sources ────────────────────────────────────────────

router.post('/sources', 
  validate.body(schemas.source),
  asyncHandler(async (req, res) => {
  const { name, url, rssUrl, region, category, city, sourceType } = req.body;
  const validSourceTypes = ['rss', 'telegram', 'youtube'] as const;
  const resolvedSourceType = validSourceTypes.includes(sourceType) ? sourceType : 'rss';

  try {
    if (!name?.trim() || !url?.trim() || !rssUrl?.trim()) {
      throw new BadRequestError('name, url and rssUrl are required');
    }
    if (!NEWS_REGIONS.includes(region)) {
      throw new BadRequestError(`region must be one of: ${NEWS_REGIONS.join(', ')}`);
    }
    if (!NEWS_CATEGORIES.includes(category)) {
      throw new BadRequestError(`category must be one of: ${NEWS_CATEGORIES.join(', ')}`);
    }

    const source = await newsSourceRepository.insert({
      name: name.trim(),
      url: url.trim(),
      rssUrl: rssUrl.trim(),
      region,
      category,
      city: city?.trim() || null,
      sourceType: resolvedSourceType,
      isActive: true,
    });

    logAdminAction('CREATE', 'news_source', req, true, { 
      newValue: { sourceId: source.id, name: source.name, url: source.url, rssUrl: source.rssUrl, region, category, city, sourceType: resolvedSourceType }
    });
    res.status(201).json({ source });
  } catch (error) {
    logAdminAction('CREATE', 'news_source', req, false, { 
      newValue: { name, url, rssUrl, region, category, city, sourceType: resolvedSourceType }
    }, (error as Error).message);
    throw error;
  }
}));

// ─── PATCH /api/admin/news/sources/:id ───────────────────────────────────────

router.patch('/sources/:id', 
  validate.params(schemas.sourceId),
  asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) throw new BadRequestError('Invalid source ID');

  try {
    const existing = await newsSourceRepository.findById(id);
    if (!existing) throw new NotFoundError('Source not found');

    const { name, url, rssUrl, region, category, city, isActive, sourceType } = req.body;
    const updates: Record<string, any> = {};

    if (name !== undefined) updates.name = name.trim();
    if (url !== undefined) updates.url = url.trim();
    if (rssUrl !== undefined) updates.rssUrl = rssUrl.trim();
    if (city !== undefined) updates.city = city?.trim() || null;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (req.body.isFeatured !== undefined) updates.isFeatured = Boolean(req.body.isFeatured);
    if (sourceType !== undefined) {
      const validSourceTypes = ['rss', 'telegram', 'youtube'];
      if (!validSourceTypes.includes(sourceType)) throw new BadRequestError(`sourceType must be one of: ${validSourceTypes.join(', ')}`);
      updates.sourceType = sourceType;
    }

    if (region !== undefined) {
      if (!NEWS_REGIONS.includes(region)) throw new BadRequestError(`region must be one of: ${NEWS_REGIONS.join(', ')}`);
      updates.region = region;
    }
    if (category !== undefined) {
      if (!NEWS_CATEGORIES.includes(category)) throw new BadRequestError(`category must be one of: ${NEWS_CATEGORIES.join(', ')}`);
      updates.category = category;
    }

    if (!Object.keys(updates).length) throw new BadRequestError('No valid fields to update');

    const source = await newsSourceRepository.update(id, updates);
    logAdminAction('UPDATE', 'news_source', req, true, { 
      oldValue: { 
        sourceId: id, 
        name: existing.name, 
        url: existing.url, 
        rssUrl: existing.rssUrl, 
        region: existing.region, 
        category: existing.category, 
        city: existing.city, 
        isActive: existing.isActive 
      },
      newValue: { sourceId: id, ...updates }
    });
    res.json({ source });
  } catch (error) {
    logAdminAction('UPDATE', 'news_source', req, false, { 
      newValue: { sourceId: id }
    }, (error as Error).message);
    throw error;
  }
}));

// ─── DELETE /api/admin/news/sources/:id ──────────────────────────────────────

router.delete('/sources/:id', 
  validate.params(schemas.sourceId),
  asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) throw new BadRequestError('Invalid source ID');

  try {
    const existing = await newsSourceRepository.findById(id);
    if (!existing) throw new NotFoundError('Source not found');

    await newsSourceRepository.delete(id);
    logAdminAction('DELETE', 'news_source', req, true, {
      oldValue: { sourceId: id, name: existing.name }
    });
    res.json({ ok: true });
  } catch (error) {
    logAdminAction('DELETE', 'news_source', req, false, {
      newValue: { sourceId: id }
    }, (error as Error).message);
    throw error;
  }
}));

// ─── POST /api/admin/news/collect ────────────────────────────────────────────

router.post('/collect', asyncHandler(async (req, res) => {
  try {
    const { collectNewsUseCase } = await import('../../application/news/CollectNewsUseCase');
    const before = Date.now();
    const articlesCollected = await collectNewsUseCase.execute();
    const durationMs = Date.now() - before;
    
    logAdminAction('MANUAL_COLLECT', 'rss_collection', req, true, { 
      newValue: { articlesCollected, durationMs }
    });
    res.json({ ok: true, durationMs, articlesCollected });
  } catch (error) {
    logAdminAction('MANUAL_COLLECT', 'rss_collection', req, false, {}, (error as Error).message);
    throw error;
  }
}));

export default router;
