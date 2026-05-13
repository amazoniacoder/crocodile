import { Router } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { authenticateAdmin } from '../../../middleware/security';
import { newsSourceRepository } from '../../../infrastructure/persistence/NewsSourceRepository';
import { BadRequestError } from '../../../../shared/utils/errors';
import { z } from 'zod';
import { db } from '../../../db/db';
import { sql } from 'drizzle-orm';

const router = Router();

router.use(authenticateAdmin);

const createYouTubeSourceSchema = z.object({
  name: z.string().min(1).max(255),
  channelId: z.string().min(10).max(100).regex(/^UC[\w-]+$/, 'channelId must start with UC'),
  region: z.enum(['russia', 'world']),
  category: z.enum(['economy', 'tech', 'politics', 'society', 'other']),
});

// GET /api/admin/youtube/sources
router.get('/sources', asyncHandler(async (_req, res) => {
  const sources = await newsSourceRepository.findAll();
  const youtubeSources = sources.filter(s => s.sourceType === 'youtube');
  res.json({ success: true, sources: youtubeSources, total: youtubeSources.length });
}));

// POST /api/admin/youtube/sources
router.post('/sources', asyncHandler(async (req, res) => {
  const validation = createYouTubeSourceSchema.safeParse(req.body);
  if (!validation.success) {
    throw new BadRequestError(validation.error.errors[0].message);
  }

  const { name, channelId, region, category } = validation.data;
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const url = `https://www.youtube.com/channel/${channelId}`;

  const source = await newsSourceRepository.insert({
    name,
    url,
    rssUrl,
    region,
    category,
    city: null,
    sourceType: 'youtube',
    isActive: true,
  });

  res.status(201).json({ success: true, source });
}));

// PATCH /api/admin/youtube/sources/:id
router.patch('/sources/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) throw new BadRequestError('Invalid source ID');

  const updateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    region: z.enum(['russia', 'world']).optional(),
    category: z.enum(['economy', 'tech', 'politics', 'society', 'other']).optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    isPrivate: z.boolean().optional(),
  });

  const validation = updateSchema.safeParse(req.body);
  if (!validation.success) throw new BadRequestError(validation.error.errors[0].message);

  const updated = await newsSourceRepository.update(id, validation.data);
  res.json({ success: true, source: updated });
}));

// DELETE /api/admin/youtube/sources/:id
router.delete('/sources/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) throw new BadRequestError('Invalid source ID');

  await newsSourceRepository.delete(id);
  res.json({ success: true });
}));

// GET /api/admin/youtube/stats
router.get('/stats', asyncHandler(async (_req, res) => {
  const result = await db.execute(sql`
    SELECT
      ns.name AS source_name,
      COUNT(na.id)::int AS articles_count,
      MAX(na.fetched_at) AS last_fetched,
      MIN(na.published_at) AS oldest_article,
      MAX(na.published_at) AS newest_article
    FROM news_articles na
    JOIN news_sources ns ON na.source_id = ns.id
    WHERE ns.source_type = 'youtube'
    GROUP BY ns.id, ns.name
    ORDER BY articles_count DESC
  `);

  const stats = result.rows.map(row => ({
    sourceName: row.source_name,
    articlesCount: row.articles_count,
    lastFetched: row.last_fetched,
    oldestArticle: row.oldest_article,
    newestArticle: row.newest_article,
  }));

  res.json({ stats });
}));

export default router;
