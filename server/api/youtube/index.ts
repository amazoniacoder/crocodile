import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { newsSourceRepository } from '../../infrastructure/persistence/NewsSourceRepository';
import { sourceConfigRepository } from '../../infrastructure/persistence/SourceConfigRepository';
import { NotFoundError } from '../../../shared/utils/errors';

const router = Router();

// GET /api/youtube/status — флаг включения страницы
router.get('/status', asyncHandler(async (_req, res) => {
  const value = await sourceConfigRepository.get('youtube_page_enabled');
  res.json({ enabled: value !== 'false' }); // по умолчанию включено
}));

// GET /api/youtube/channels — публичный список активных YouTube-каналов
router.get('/channels', asyncHandler(async (_req, res) => {
  const sources = await newsSourceRepository.findAll();
  const channels = sources
    .filter(s => s.sourceType === 'youtube' && s.isActive && !s.isPrivate)
    .map(s => ({
      id: s.id,
      name: s.name,
      region: s.region,
      category: s.category,
      logoUrl: s.logoUrl ?? null,
      isFeatured: s.isFeatured ?? false,
    }));
  res.json({ channels });
}));

// GET /api/youtube/channel/:channelId — инфо о канале для YouTubeChannelPage
router.get('/channel/:channelId', asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  const sources = await newsSourceRepository.findAll();
  const source = sources.find(s =>
    s.sourceType === 'youtube' &&
    !s.isPrivate &&
    (s.url.includes(channelId) || s.rssUrl.includes(channelId))
  );

  if (!source) throw new NotFoundError('Channel not found');

  res.json({
    channel: {
      channelId,
      name: source.name,
      region: source.region,
      category: source.category,
      description: source.description ?? null,
      logoUrl: source.logoUrl ?? null,
      url: source.url,
      isFeatured: source.isFeatured ?? false,
    },
  });
}));

export default router;
