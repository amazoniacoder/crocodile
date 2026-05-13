import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import type { NewsArticleWithCluster } from '@shared/types/news';

// Импортируем модули после fake-indexeddb/auto
import { db } from '../services/db';
import {
  buildFeedKey,
  saveFeedSlice,
  loadFeedSlice,
  saveArticleDetail,
  loadArticleDetail,
  runOfflineGC,
} from '../services/offlineStore';
import {
  enqueuePendingAction,
  flushPendingActions,
} from '../services/pendingActionsService';

const makeArticle = (id: number, daysAgo = 0): NewsArticleWithCluster => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    id,
    sourceId: 1,
    sourceName: 'Test',
    title: `Article ${id}`,
    description: null,
    imageUrl: null,
    url: `https://example.com/${id}`,
    publishedAt: d.toISOString(),
    fetchedAt: d.toISOString(),
    region: 'russia',
    category: 'other',
    clusterId: null,
    isArchived: false,
    createdAt: d.toISOString(),
    cluster: null,
    clusterArticles: [],
  };
};

beforeEach(async () => {
  await db.articles.clear();
  await db.feedSlices.clear();
  await db.articleDetails.clear();
  await db.pendingActions.clear();
});

// ─── buildFeedKey ────────────────────────────────────────────────────────────

describe('buildFeedKey', () => {
  it('одинаковый ключ независимо от порядка параметров', () => {
    const a = buildFeedKey({ region: 'russia', category: 'tech' });
    const b = buildFeedKey({ category: 'tech', region: 'russia' });
    expect(a).toBe(b);
  });

  it('пустые/null/undefined значения не попадают в ключ', () => {
    const a = buildFeedKey({ region: 'russia', city: null, sourceId: undefined });
    const b = buildFeedKey({ region: 'russia' });
    expect(a).toBe(b);
  });

  it('возвращает "default" для пустого объекта', () => {
    expect(buildFeedKey({})).toBe('default');
  });
});

// ─── saveFeedSlice / loadFeedSlice ───────────────────────────────────────────

describe('saveFeedSlice / loadFeedSlice', () => {
  it('сохраняет и читает ленту', async () => {
    const articles = [makeArticle(1), makeArticle(2)];
    const key = buildFeedKey({ region: 'russia' });

    await saveFeedSlice(key, articles);
    const result = await loadFeedSlice(key);

    expect(result).toHaveLength(2);
    expect(result?.map(a => a.id)).toEqual([1, 2]);
  });

  it('возвращает null для несуществующего ключа', async () => {
    expect(await loadFeedSlice('nonexistent')).toBeNull();
  });

  it('перезаписывает срез при повторном сохранении', async () => {
    const key = buildFeedKey({ region: 'world' });
    await saveFeedSlice(key, [makeArticle(1), makeArticle(2)]);
    await saveFeedSlice(key, [makeArticle(3)]);

    const result = await loadFeedSlice(key);
    expect(result?.map(a => a.id)).toEqual([3]);
  });
});

// ─── saveArticleDetail / loadArticleDetail ───────────────────────────────────

describe('saveArticleDetail / loadArticleDetail', () => {
  it('сохраняет и читает деталь', async () => {
    const detail = {
      article: makeArticle(42) as any,
      clusterSources: [],
      similarArticles: [],
      otherArticles: [],
    };
    await saveArticleDetail(42, detail);
    const result = await loadArticleDetail(42);
    expect(result?.article.id).toBe(42);
  });

  it('возвращает null для несохранённой статьи', async () => {
    expect(await loadArticleDetail(999)).toBeNull();
  });

  it('удаляет и возвращает null для устаревшей записи', async () => {
    const detail = {
      article: makeArticle(10) as any,
      clusterSources: [],
      similarArticles: [],
      otherArticles: [],
    };
    await saveArticleDetail(10, detail);

    const TTL_MS = 14 * 24 * 60 * 60 * 1000;
    await db.articleDetails.update(10, { savedAt: Date.now() - TTL_MS - 1000 });

    expect(await loadArticleDetail(10)).toBeNull();
  });
});

// ─── runOfflineGC ────────────────────────────────────────────────────────────

describe('runOfflineGC', () => {
  it('удаляет статьи старше 14 дней', async () => {
    const key = buildFeedKey({ region: 'russia' });
    await saveFeedSlice(key, [makeArticle(1, 0), makeArticle(2, 15)]);

    await runOfflineGC();

    expect(await db.articles.count()).toBe(1);
    expect(await db.articles.get(2)).toBeUndefined();
  });

  it('чистит feedSlice от удалённых статей', async () => {
    const key = buildFeedKey({ region: 'russia' });
    await saveFeedSlice(key, [makeArticle(1, 0), makeArticle(2, 15)]);

    await runOfflineGC();

    const slice = await db.feedSlices.get(key);
    expect(slice?.articleIds).toEqual([1]);
  });

  it('удаляет пустой срез целиком', async () => {
    const key = buildFeedKey({ region: 'world' });
    await saveFeedSlice(key, [makeArticle(1, 15)]);

    await runOfflineGC();

    expect(await db.feedSlices.get(key)).toBeUndefined();
  });
});

// ─── pendingActions ──────────────────────────────────────────────────────────

describe('pendingActions', () => {
  it('добавляет действие в очередь', async () => {
    await enqueuePendingAction('react', { articleId: 1, type: 'like' });
    expect(await db.pendingActions.count()).toBe(1);
  });

  it('flushPendingActions удаляет успешно отправленные', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    await enqueuePendingAction('react', { articleId: 1, type: 'like' });
    await flushPendingActions();

    expect(await db.pendingActions.count()).toBe(0);
    vi.unstubAllGlobals();
  });

  it('инкрементирует retries при неудачной отправке', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await enqueuePendingAction('react', { articleId: 1, type: 'like' });
    await flushPendingActions();

    const action = await db.pendingActions.toCollection().first();
    expect(action?.retries).toBe(1);
    expect(action?.status).toBe('pending');
    vi.unstubAllGlobals();
  });

  it('помечает status=failed после MAX_RETRIES=3', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await enqueuePendingAction('react', { articleId: 1, type: 'like' });
    await flushPendingActions();
    await flushPendingActions();
    await flushPendingActions();

    const action = await db.pendingActions.toCollection().first();
    expect(action?.status).toBe('failed');
    vi.unstubAllGlobals();
  });

  it('отправляет emotion action', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    await enqueuePendingAction('emotion', { articleId: 5, emotionId: 'fire' });
    await flushPendingActions();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/news/5/emotion',
      expect.objectContaining({ method: 'POST' })
    );
    vi.unstubAllGlobals();
  });
});
