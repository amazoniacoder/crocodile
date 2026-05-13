import { Router } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { authenticateAdmin } from '../../../middleware/security';
import { newsSourceRepository } from '../../../infrastructure/persistence/NewsSourceRepository';
import { BadRequestError } from '../../../../shared/utils/errors';
import { z } from 'zod';

const router = Router();

router.use(authenticateAdmin);

const createTelegramSourceSchema = z.object({
  name: z.string().min(1).max(255),
  channelUsername: z.string().min(1).max(100),
  region: z.enum(['russia', 'world']),
  category: z.enum(['economy', 'tech', 'politics', 'society', 'other']),
});

router.get('/sources', asyncHandler(async (req, res) => {
  const sources = await newsSourceRepository.findAll();
  const telegramSources = sources.filter(s => s.sourceType === 'telegram' && !s.isPrivate);
  
  res.json({
    success: true,
    sources: telegramSources,
    total: telegramSources.length,
  });
}));

router.post('/sources', asyncHandler(async (req, res) => {
  const validation = createTelegramSourceSchema.safeParse(req.body);
  
  if (!validation.success) {
    throw new BadRequestError(validation.error.errors[0].message);
  }

  const { name, channelUsername, region, category } = validation.data;

  const rsshubUrl = process.env.RSSHUB_URL || 'http://localhost:1200';
  const rssUrl = `${rsshubUrl}/telegram/channel/${channelUsername}`;

  const source = await newsSourceRepository.insert({
    name,
    url: `https://t.me/${channelUsername}`,
    rssUrl,
    region,
    category,
    city: null,
    sourceType: 'telegram',
    isActive: true,
  });

  res.status(201).json({
    success: true,
    source,
  });
}));

router.patch('/sources/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    throw new BadRequestError('Invalid source ID');
  }

  const updateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    region: z.enum(['russia', 'world']).optional(),
    category: z.enum(['economy', 'tech', 'politics', 'society', 'other']).optional(),
    isActive: z.boolean().optional(),
    isPrivate: z.boolean().optional(),
  });

  const validation = updateSchema.safeParse(req.body);
  if (!validation.success) {
    throw new BadRequestError(validation.error.errors[0].message);
  }

  const updated = await newsSourceRepository.update(id, validation.data);

  res.json({
    success: true,
    source: updated,
  });
}));

router.delete('/sources/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) throw new BadRequestError('Invalid source ID');

  await newsSourceRepository.delete(id);
  res.json({ success: true });
}));

export default router;
