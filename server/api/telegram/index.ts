import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { newsSourceRepository } from '../../infrastructure/persistence/NewsSourceRepository';
import { sourceConfigRepository } from '../../infrastructure/persistence/SourceConfigRepository';
import { NotFoundError } from '../../../shared/utils/errors';

const router = Router();

// GET /api/telegram/channels — публичный список активных Telegram-каналов
router.get('/channels', asyncHandler(async (_req, res) => {
  const sources = await newsSourceRepository.findAll();
  const channels = sources
    .filter(s => s.sourceType === 'telegram' && s.isActive)
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

// GET /api/telegram/status — флаг включения страницы
router.get('/status', asyncHandler(async (_req, res) => {
  const value = await sourceConfigRepository.get('telegram_page_enabled');
  res.json({ enabled: value === 'true' });
}));

// GET /api/telegram/channel/:username — инфо о канале для TelegramChannelPage
router.get('/channel/:username', asyncHandler(async (req, res) => {
  const { username } = req.params;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);

  const sources = await newsSourceRepository.findAll();
  const source = sources.find(s =>
    s.sourceType === 'telegram' &&
    (s.url.includes(`t.me/${username}`) || (s as any).channelUsername === username)
  );

  if (!source) throw new NotFoundError('Channel not found');

  res.json({
    channel: {
      username,
      name: source.name,
      region: source.region,
      category: source.category,
      description: source.description ?? null,
      logoUrl: source.logoUrl ?? null,
    },
    page,
    limit,
  });
}));

export default router;
