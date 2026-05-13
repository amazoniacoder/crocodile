import Parser from 'rss-parser';
import sanitizeHtml from 'sanitize-html';
import type { NewsSource } from '../../domain/news/NewsSource';
import type { NewArticleInput, NewsRegion, NewsCategory } from '../../domain/news/NewsArticle';

// ─── Парсеры ─────────────────────────────────────────────────────────────────

const PARSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/rss+xml, application/xml, text/xml, */*',
};

const parserStrict = new Parser({
  timeout: 5000,
  headers: PARSER_HEADERS,
  defaultRSS: 2.0,
  xml2js: { strict: true, normalize: false, normalizeTags: false },
  customFields: {
    item: [
      ['rbc_news:newsline', 'newsline'],
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:group', 'mediaGroup'],
      ['enclosure', 'enclosure'],
      ['yt:videoId', 'ytVideoId'],
    ],
  },
});

// Fallback для региональных сайтов с невалидным XML
const parserLenient = new Parser({
  timeout: 5000,
  headers: PARSER_HEADERS,
  defaultRSS: 2.0,
  xml2js: { strict: false, normalize: false, normalizeTags: false },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:group', 'mediaGroup'],
      ['enclosure', 'enclosure'],
      ['yt:videoId', 'ytVideoId'],
    ],
  },
});

// ─── RBC newsline маппинг ────────────────────────────────────────────────────

const RBC_NEWSLINE_MAP: Record<string, { category: NewsCategory; region: NewsRegion }> = {
  politics:             { category: 'politics', region: 'russia' },
  economics:            { category: 'economy',  region: 'russia' },
  technology_and_media: { category: 'tech',     region: 'russia' },
  society:              { category: 'society',  region: 'russia' },
  sport:                { category: 'society',  region: 'russia' },
  culture:              { category: 'society',  region: 'russia' },
  world:                { category: 'other',    region: 'world'  },
  business:             { category: 'economy',  region: 'russia' },
};

// ─── Вспомогательные функции ─────────────────────────────────────────────────

function extractImageUrl(item: any): string | null {
  const media = item.mediaContent;

  if (Array.isArray(media)) {
    const img = media.find((m: any) => m?.$.type?.startsWith('image'));
    if (img?.$.url) return img.$.url;
    const vid = media.find((m: any) => m?.$.type?.startsWith('video'));
    if (vid?.$.url) return `video:${vid.$.url}`;
    if (media[0]?.$.url) return media[0].$.url;
  } else if (media?.$.url) {
    if (media.$.type?.startsWith('video')) return `video:${media.$.url}`;
    return media.$.url;
  }

  const enc = item.enclosure;
  if (Array.isArray(enc)) {
    const img = enc.find((e: any) => e?.$.type?.startsWith('image'));
    if (img?.$.url) return img.$.url;
    const vid = enc.find((e: any) => e?.$.type?.startsWith('video'));
    if (vid?.$.url) return `video:${vid.$.url}`;
  } else if (enc?.url) {
    if (enc.type?.startsWith('video')) return `video:${enc.url}`;
    if (enc.type?.startsWith('image')) return enc.url;
  }

  return null;
}

function isXmlError(err: any): boolean {
  const msg: string = err?.message ?? '';
  return (
    msg.includes('Attribute without value') ||
    msg.includes('Invalid character') ||
    msg.includes('not recognized')
  );
}

function sanitizeDescription(raw: string | undefined): string | null {
  if (!raw) return null;
  return sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} }).slice(0, 500) || null;
}

// ─── Публичный интерфейс ─────────────────────────────────────────────────────

export interface ParsedFeed {
  articles: NewArticleInput[];
  feedMeta?: {
    description: string | null;
    logoUrl: string | null;
  };
}

/**
 * Парсит RSS-ленту источника и возвращает нормализованные статьи.
 * Без побочных эффектов — не пишет в БД, не эмитит события.
 * Применяет lenient-парсер автоматически при XML-ошибке.
 */
export async function parseSourceFeed(source: NewsSource): Promise<ParsedFeed> {
  let feed;

  try {
    feed = await parserStrict.parseURL(source.rssUrl);
  } catch (err) {
    if (isXmlError(err)) {
      feed = await parserLenient.parseURL(source.rssUrl);
    } else {
      throw err;
    }
  }

  if (!feed.items?.length) return { articles: [] };

  const feedMeta = {
    description: source.sourceType === 'telegram' ? (sanitizeDescription(feed.description) ?? null) : null,
    logoUrl: (feed as any).image?.url ?? null,
  };

  const articles: NewArticleInput[] = [];

  for (const item of feed.items.slice(0, 50)) {
    const url = item.link?.trim();
    const title = item.title?.trim();
    if (!url || !title) continue;

    const rawText = item.contentSnippet || item.summary || item.content;
    const description = sanitizeDescription(rawText);
    const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();
    let imageUrl = extractImageUrl(item);

    let region: NewsRegion = source.region;
    let category: NewsCategory = source.category;
    let channelUsername: string | null = null;
    let messageId: number | null = null;
    let videoId: string | null = null;

    // Специальная логика RBC: категория и регион из поля newsline
    const newsline = (item as any).newsline as string | undefined;
    if (newsline && source.url.includes('rbc.ru')) {
      const mapped = RBC_NEWSLINE_MAP[newsline];
      if (mapped) {
        region = mapped.region;
        category = mapped.category;
      }
    }

    // Парсинг Telegram: извлекаем channel_username и message_id из URL
    if (source.sourceType === 'telegram' && url.includes('t.me/')) {
      const match = url.match(/t\.me\/([^\/]+)\/(\d+)/);
      if (match) {
        channelUsername = match[1];
        messageId = parseInt(match[2], 10);
      }
    }

    // Парсинг YouTube: извлекаем videoId и thumbnail
    if (source.sourceType === 'youtube') {
      // videoId из yt:videoId или из URL
      const ytId = (item as any).ytVideoId;
      if (ytId) {
        videoId = Array.isArray(ytId) ? ytId[0] : ytId;
      } else {
        const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
        if (match) videoId = match[1];
      }
      // thumbnail из media:group > media:thumbnail или напрямую
      if (!imageUrl && videoId) {
        imageUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      }
      const group = (item as any).mediaGroup;
      if (group) {
        const thumb = Array.isArray(group) ? group[0]?.['media:thumbnail']?.[0] : group['media:thumbnail']?.[0];
        if (thumb?.$?.url) imageUrl = thumb.$.url;
      }
    }

    articles.push({ 
      sourceId: source.id, 
      title, 
      description, 
      imageUrl, 
      url, 
      publishedAt, 
      region, 
      category,
      sourceType: source.sourceType || 'rss',
      channelUsername,
      messageId,
      videoId,
    });
  }

  return { articles, feedMeta };
}
