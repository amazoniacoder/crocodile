import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { newsArticleRepository } from '../../infrastructure/persistence/NewsArticleRepository';
import { newsSourceRepository } from '../../infrastructure/persistence/NewsSourceRepository';
import { setCacheHeaders } from '../../middleware/cacheHeaders';
import type { NewsArticle } from '../../domain/news/NewsArticle';

const router = Router();

const CATEGORY_LABELS: Record<string, string> = {
  economy: 'Экономика',
  tech: 'Технологии',
  politics: 'Политика',
  society: 'Общество',
  other: 'Другое',
};

const REGION_LABELS: Record<string, string> = {
  russia: 'Россия',
  world: 'Мир',
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildRssFeed(
  articles: (NewsArticle & { sourceName: string })[],
  params: { region?: string; category?: string; baseUrl: string }
): string {
  const regionLabel = params.region && params.region !== 'all'
    ? ` — ${REGION_LABELS[params.region] ?? params.region}`
    : '';
  const categoryLabel = params.category && params.category !== 'all'
    ? ` — ${CATEGORY_LABELS[params.category] ?? params.category}`
    : '';

  const title = `Crocodile${regionLabel}${categoryLabel}`;
  const description = 'Новости без лишней чешуи. Без алгоритмов, без манипуляций.';
  const link = params.baseUrl;
  const now = new Date().toUTCString();

  const items = articles.map(a => {
    const pubDate = (a.publishedAt instanceof Date ? a.publishedAt : new Date(a.publishedAt)).toUTCString();
    const articleUrl = `${params.baseUrl}/news/${a.id}`;
    const description = a.description ? `<description>${escapeXml(a.description)}</description>` : '';
    const image = a.imageUrl ? `<enclosure url="${escapeXml(a.imageUrl)}" type="image/jpeg" length="0"/>` : '';

    return `
    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${escapeXml(a.url)}</link>
      <guid isPermaLink="false">${escapeXml(articleUrl)}</guid>
      ${description}
      <pubDate>${pubDate}</pubDate>
      <source url="${escapeXml(params.baseUrl)}">${escapeXml(a.sourceName)}</source>
      <category>${escapeXml(CATEGORY_LABELS[a.category] ?? a.category)}</category>
      ${image}
    </item>`.trim();
  }).join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(description)}</description>
    <language>ru</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${escapeXml(link + '/api/rss')}" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;
}

// ─── GET /api/rss ─────────────────────────────────────────────────────────────
// Параметры: region, category, limit (max 50)
// Пример: /api/rss?region=russia&category=tech

router.get('/',
  setCacheHeaders({ public: true, maxAge: 300 }),
  asyncHandler(async (req, res) => {
    const region = req.query.region as string | undefined;
    const category = req.query.category as string | undefined;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    const { articles } = await newsArticleRepository.findMany(
      {
        region: region as any,
        category: category as any,
      },
      1,
      limit
    );

    const sourceIds = [...new Set(articles.map(a => a.sourceId).filter(Boolean))] as number[];
    const sourceMap = await newsArticleRepository.findSourceDisplay(sourceIds);

    const withSources = articles.map(a => ({
      ...a,
      sourceName: a.sourceId != null ? (sourceMap.get(a.sourceId)?.name ?? 'Unknown') : 'Unknown',
    }));

    const proto = req.headers['x-forwarded-proto'] ?? req.protocol;
    const baseUrl = `${proto}://${req.headers.host}`;

    const xml = buildRssFeed(withSources, { region, category, baseUrl });

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(xml);
  })
);

export default router;
