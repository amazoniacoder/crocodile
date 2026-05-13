import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { authenticateUserToken, userTokenRateLimit } from '../../middleware/userTokenAuth';
import { personalFeedService } from '../../application/user/PersonalFeedService';
import { userSubscriptionRepository } from '../../infrastructure/persistence/UserSubscriptionRepository';
import { userBookmarkRepository } from '../../infrastructure/persistence/UserBookmarkRepository';
import { newsSourceRepository } from '../../infrastructure/persistence/NewsSourceRepository';
import { newsArticleRepository } from '../../infrastructure/persistence/NewsArticleRepository';
import { userTokenService } from '../../infrastructure/auth/UserTokenService';
import { BadRequestError } from '../../../shared/utils/errors';

const router = Router();

// Применяем rate limiting ко всем роутам
router.use(userTokenRateLimit);

// GET /api/my/validate — проверка валидности токена
router.get('/validate', asyncHandler(async (req, res) => {
  const token = (req.query.token as string) || req.headers['x-user-token'] as string;
  
  if (!token) {
    res.status(400).json({ valid: false, error: 'Token required' });
    return;
  }

  const result = await userTokenService.validateToken(token);
  
  res.json({
    valid: result.valid,
    tokenId: result.tokenId ?? null,
    isAdmin: result.isAdmin ?? false,
    expiresAt: result.expiresAt?.toISOString() ?? null,
  });
}));

// Все остальные роуты требуют аутентификации
router.use(authenticateUserToken);

// GET /api/my/feed — персональная лента
router.get('/feed', asyncHandler(async (req, res) => {
  const tokenId = req.userTokenId!;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);

  const { articles, total } = await personalFeedService.getPersonalFeed(
    tokenId,
    {
      sourceType: req.query.sourceType as any,
      q: req.query.q as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    },
    page,
    limit
  );

  // Добавляем информацию об источниках
  const sourceIds = [...new Set(articles.map(a => a.sourceId).filter(Boolean))] as number[];
  const sourceMap = await newsArticleRepository.findSourceDisplay(sourceIds);
  const sources = await newsSourceRepository.findAll();
  const sourceTypeMap = new Map(sources.map(s => [s.id, s.sourceType]));

  const result = articles.map(a => {
    const src = a.sourceId != null ? sourceMap.get(a.sourceId) : undefined;
    const sourceType = a.sourceId != null ? (sourceTypeMap.get(a.sourceId) ?? a.sourceType ?? 'rss') : (a.sourceType ?? 'rss');
    return {
      ...a,
      sourceType,
      sourceName: src?.name ?? 'Unknown',
      sourceCity: src?.city ?? null,
      sourceLogoUrl: src?.logoUrl ?? null,
      sourceChannelId: src?.channelId ?? null,
    };
  });

  res.json({
    articles: result,
    total,
    page,
    limit,
    hasMore: (page - 1) * limit + articles.length < total,
  });
}));

// GET /api/my/digest — дайджест за период
router.get('/digest', asyncHandler(async (req, res) => {
  const tokenId = req.userTokenId!;
  const period = req.query.period === 'week' ? 'week' : 'day';
  const digest = await personalFeedService.getDigest(tokenId, period);
  res.json(digest);
}));

// GET /api/my/available-channels — список доступных каналов
router.get('/available-channels', asyncHandler(async (req, res) => {
  const tokenId = req.userTokenId!;
  const isAdmin = req.isAdmin ?? false;
  
  const sources = await newsSourceRepository.findAll();
  
  let channels;
  
  if (isAdmin) {
    // Админ видит все публичные каналы + свои приватные
    const { adminChannelAccessRepository } = await import('../../infrastructure/persistence/AdminChannelAccessRepository');
    const privateSourceIds = await adminChannelAccessRepository.getAccessibleSourceIds(tokenId);
    
    channels = sources
      .filter(s => 
        (s.sourceType === 'telegram' || s.sourceType === 'youtube') && 
        s.isActive &&
        (s.isPrivate === false || privateSourceIds.includes(s.id))
      )
      .map(s => ({
        id: s.id,
        name: s.name,
        sourceType: s.sourceType,
        region: s.region,
        category: s.category,
        logoUrl: s.logoUrl ?? null,
        username: s.username ?? null,
        channelId: s.channelId ?? null,
        isPrivate: s.isPrivate ?? false,
      }));
  } else {
    // Обычный пользователь видит только публичные каналы
    channels = sources
      .filter(s => 
        (s.sourceType === 'telegram' || s.sourceType === 'youtube') && 
        s.isActive &&
        s.isPrivate === false
      )
      .map(s => ({
        id: s.id,
        name: s.name,
        sourceType: s.sourceType,
        region: s.region,
        category: s.category,
        logoUrl: s.logoUrl ?? null,
        username: s.username ?? null,
        channelId: s.channelId ?? null,
      }));
  }

  res.json({ channels });
}));

// GET /api/my/subscriptions — текущие подписки
router.get('/subscriptions', asyncHandler(async (req, res) => {
  const tokenId = req.userTokenId!;
  const sourceIds = await userSubscriptionRepository.findByTokenId(tokenId);
  res.json({ sourceIds });
}));

// POST /api/my/subscriptions — обновить подписки
router.post('/subscriptions', asyncHandler(async (req, res) => {
  const tokenId = req.userTokenId!;
  const { sourceIds } = req.body;

  if (!Array.isArray(sourceIds)) {
    throw new BadRequestError('sourceIds must be an array');
  }

  const validIds = sourceIds.filter(id => typeof id === 'number' && id > 0);
  
  await userSubscriptionRepository.replaceSubscriptions(tokenId, validIds);

  res.json({ ok: true, sourceIds: validIds });
}));

// GET /api/my/feed.rss — персональный RSS-экспорт
// Параметры: ?sourceType=all|telegram|youtube  ?limit=10..100
router.get('/feed.rss', asyncHandler(async (req, res) => {
  const tokenId = req.userTokenId!;
  const rawType = req.query.sourceType as string | undefined;
  const sourceType = (rawType === 'telegram' || rawType === 'youtube') ? rawType : undefined;
  const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string) || 50));

  const { articles } = await personalFeedService.getPersonalFeed(
    tokenId,
    sourceType ? { sourceType } : {},
    1,
    limit
  );

  const sourceIds = [...new Set(articles.map((a: any) => a.sourceId).filter(Boolean))] as number[];
  const sourceMap = await newsArticleRepository.findSourceDisplay(sourceIds);

  const proto = req.headers['x-forwarded-proto'] ?? req.protocol;
  const baseUrl = `${proto}://${req.headers.host}`;

  const escapeXml = (s: string) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  const selfParams = new URLSearchParams();
  if (sourceType) selfParams.set('sourceType', sourceType);
  if (limit !== 50) selfParams.set('limit', String(limit));
  const selfQuery = selfParams.toString() ? `?${selfParams}` : '';
  const selfUrl = `${baseUrl}/api/my/feed.rss${selfQuery}`;

  const titleSuffix = sourceType === 'telegram' ? ' · Telegram' : sourceType === 'youtube' ? ' · YouTube' : '';

  const items = articles.map((a: any) => {
    const src = a.sourceId != null ? sourceMap.get(a.sourceId) : undefined;
    const sourceName = src?.name ?? 'Unknown';
    const pubDate = new Date(a.publishedAt).toUTCString();
    return `<item>
      <title>${escapeXml(a.title)}</title>
      <link>${escapeXml(a.url)}</link>
      <guid isPermaLink="false">${escapeXml(`${baseUrl}/news/${a.id}`)}</guid>
      ${a.description ? `<description>${escapeXml(a.description)}</description>` : ''}
      <pubDate>${pubDate}</pubDate>
      <source url="${escapeXml(baseUrl)}">${escapeXml(sourceName)}</source>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Crocodile — Моя лента${escapeXml(titleSuffix)}</title>
    <link>${escapeXml(baseUrl + '/my')}</link>
    <atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml"/>
    <description>Персональная лента из выбранных каналов${escapeXml(titleSuffix)}</description>
    <language>ru</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(xml);
}));

// GET /api/my/bookmarks — список закладок
router.get('/bookmarks', asyncHandler(async (req, res) => {
  const tokenId = req.userTokenId!;
  const articles = await userBookmarkRepository.findArticlesByTokenId(tokenId);
  res.json({ articles });
}));

// POST /api/my/bookmarks — добавить закладку
router.post('/bookmarks', asyncHandler(async (req, res) => {
  const tokenId = req.userTokenId!;
  const { articleId } = req.body;
  if (typeof articleId !== 'number') throw new BadRequestError('articleId required');
  await userBookmarkRepository.add(tokenId, articleId);
  res.json({ ok: true });
}));

// DELETE /api/my/bookmarks/:articleId — удалить закладку
router.delete('/bookmarks/:articleId', asyncHandler(async (req, res) => {
  const tokenId = req.userTokenId!;
  const articleId = parseInt(req.params.articleId);
  if (isNaN(articleId)) throw new BadRequestError('Invalid articleId');
  await userBookmarkRepository.remove(tokenId, articleId);
  res.json({ ok: true });
}));

export default router;
