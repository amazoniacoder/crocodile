import { db } from './db';
import type { NewsArticleWithCluster, NewsDetailResponse } from '@shared/types/news';

const MAX_ARTICLES = 3000;
const TTL_MS = 14 * 24 * 60 * 60 * 1000;
const GC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const GC_LAST_RUN_KEY = 'offline:gc:lastRun';
const IMAGE_CACHE_NAME = 'news-images';

/** Нормализует параметры фильтра в строковый ключ для feedSlices */
export function buildFeedKey(params: Record<string, string | number | boolean | null | undefined>): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false)
    .sort(([a], [b]) => a.localeCompare(b));
  return sorted.map(([k, v]) => `${k}=${v}`).join('&') || 'default';
}

/** Ключ для ленты соцсетей */
export function buildSocialFeedKey(
  sourceType: 'telegram' | 'youtube',
  channelId?: string,
): string {
  return channelId ? `social:${sourceType}:${channelId}` : `social:${sourceType}`;
}

/** Сохраняет порцию ленты в IDB */
export async function saveFeedSlice(
  key: string,
  articles: NewsArticleWithCluster[],
): Promise<void> {
  try {
    await db.articles.bulkPut(articles);
    await db.feedSlices.put({
      key,
      articleIds: articles.map((a) => a.id),
      lastSyncedAt: Date.now(),
    });
  } catch {
    // quota или другие IDB-ошибки — молча игнорируем
  }
}

/** Читает ленту из IDB по ключу фильтра */
export async function loadFeedSlice(key: string): Promise<NewsArticleWithCluster[] | null> {
  try {
    const slice = await db.feedSlices.get(key);
    if (!slice || !slice.articleIds.length) return null;
    const articles = await db.articles.bulkGet(slice.articleIds);
    const result = articles.filter((a): a is NewsArticleWithCluster => a !== undefined);
    return result.length > 0 ? result : null;
  } catch {
    return null;
  }
}

/** Сохраняет закладки в IDB */
export async function saveBookmarks(articles: NewsArticleWithCluster[]): Promise<void> {
  try {
    const now = Date.now();
    await db.bookmarks.bulkPut(
      articles.map((a) => ({ articleId: a.id, savedAt: now, data: a })),
    );
  } catch { /* ignore */ }
}

/** Читает закладки из IDB */
export async function loadBookmarks(): Promise<NewsArticleWithCluster[] | null> {
  try {
    const records = await db.bookmarks.orderBy('savedAt').reverse().toArray();
    return records.length > 0 ? records.map((r) => r.data) : null;
  } catch { return null; }
}
export async function saveArticleDetail(articleId: number, data: NewsDetailResponse): Promise<void> {
  try {
    await db.articleDetails.put({ articleId, data, savedAt: Date.now() });
  } catch {
    // ignore
  }
}

/** Читает детальную страницу из IDB */
export async function loadArticleDetail(articleId: number): Promise<NewsDetailResponse | null> {
  try {
    const record = await db.articleDetails.get(articleId);
    if (!record) return null;
    if (Date.now() - record.savedAt > TTL_MS) {
      await db.articleDetails.delete(articleId);
      return null;
    }
    return record.data;
  } catch {
    return null;
  }
}

/** Очищает Cache Storage для изображений (записи старше TTL) */
async function purgeImageCache(): Promise<void> {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const keys = await cache.keys();
    const cutoff = Date.now() - TTL_MS;
    await Promise.all(
      keys.map(async (req) => {
        const res = await cache.match(req);
        if (!res) return;
        const dateHeader = res.headers.get('date');
        if (!dateHeader) return;
        if (new Date(dateHeader).getTime() < cutoff) {
          await cache.delete(req);
        }
      }),
    );
  } catch {
    // ignore — Safari Private Mode или квота
  }
}

/** GC: удаляет статьи старше 14 дней, при превышении лимита и чистит срезы */
export async function runOfflineGC(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - TTL_MS).toISOString();

    await db.articles.where('publishedAt').below(cutoff).delete();

    const detailCutoff = Date.now() - TTL_MS;
    await db.articleDetails.where('savedAt').below(detailCutoff).delete();
    await db.bookmarks.where('savedAt').below(detailCutoff).delete();

    const count = await db.articles.count();
    if (count > MAX_ARTICLES) {
      const toDelete = await db.articles
        .orderBy('publishedAt')
        .limit(count - MAX_ARTICLES)
        .primaryKeys();
      await db.articles.bulkDelete(toDelete as number[]);
    }

    const allSlices = await db.feedSlices.toArray();
    for (const slice of allSlices) {
      const existing = await db.articles.bulkGet(slice.articleIds);
      const validIds = slice.articleIds.filter((_, i) => existing[i] !== undefined);
      if (validIds.length === 0) {
        await db.feedSlices.delete(slice.key);
      } else if (validIds.length !== slice.articleIds.length) {
        await db.feedSlices.put({ ...slice, articleIds: validIds });
      }
    }

    await purgeImageCache();

    try { localStorage.setItem(GC_LAST_RUN_KEY, String(Date.now())); } catch { /* ignore */ }
  } catch {
    // ignore
  }
}

/**
 * Запускает GC не чаще раза в сутки.
 * Вызывать при старте и при событии visibilitychange → visible.
 */
export function scheduleOfflineGC(): void {
  try {
    const last = Number(localStorage.getItem(GC_LAST_RUN_KEY) ?? 0);
    if (Date.now() - last >= GC_INTERVAL_MS) {
      runOfflineGC();
    }
  } catch {
    runOfflineGC();
  }
}

/** Офлайн-поиск по уже скачанным статьям в IDB */
export async function searchOffline(
  query: string,
  limit = 50,
): Promise<NewsArticleWithCluster[]> {
  try {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return db.articles
      .filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.description ?? '').toLowerCase().includes(q)
      )
      .limit(limit)
      .toArray();
  } catch {
    return [];
  }
}

/** Полная ручная очистка всех офлайн-данных (IDB + Cache Storage) */
export async function clearAllOfflineData(): Promise<void> {
  try {
    await Promise.all([
      db.articles.clear(),
      db.feedSlices.clear(),
      db.articleDetails.clear(),
      db.pendingActions.clear(),
      db.bookmarks.clear(),
    ]);
  } catch { /* ignore */ }

  if ('caches' in window) {
    try {
      await caches.delete(IMAGE_CACHE_NAME);
    } catch { /* ignore */ }
  }

  try { localStorage.removeItem(GC_LAST_RUN_KEY); } catch { /* ignore */ }
}
