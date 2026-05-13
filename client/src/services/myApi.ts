const API_BASE = '/api/my';

export interface ValidationResponse {
  valid: boolean;
  expiresAt: string | null;
  isAdmin?: boolean;
}

export interface PersonalFeedResponse {
  articles: any[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface AvailableChannel {
  id: number;
  name: string;
  sourceType: 'telegram' | 'youtube';
  region: string;
  category: string;
  logoUrl: string | null;
  username?: string | null;
  channelId?: string | null;
  isPrivate?: boolean;
}

export interface DigestArticle {
  id: number;
  title: string;
  url: string;
  publishedAt: string;
  sourceName: string;
  sourceLogoUrl: string | null;
  sourceType: string;
  likesCount: number;
}

export interface DigestResponse {
  newCount: number;
  topArticles: DigestArticle[];
  period: 'day' | 'week';
}

export const myApi = {
  async validateToken(token: string): Promise<ValidationResponse> {
    const res = await fetch(`${API_BASE}/validate?token=${encodeURIComponent(token)}`);
    if (!res.ok) throw new Error('Validation failed');
    return res.json();
  },

  async getPersonalFeed(token: string, page = 1, limit = 20, sourceType?: 'telegram' | 'youtube', q?: string, dateFrom?: string, dateTo?: string): Promise<PersonalFeedResponse> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (sourceType) params.set('sourceType', sourceType);
    if (q?.trim()) params.set('q', q.trim());
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    const res = await fetch(`${API_BASE}/feed?${params}`, {
      headers: { 'X-User-Token': token },
    });
    if (!res.ok) throw new Error('Failed to fetch feed');
    return res.json();
  },

  async getAvailableChannels(token: string): Promise<{ channels: AvailableChannel[] }> {
    const res = await fetch(`${API_BASE}/available-channels`, {
      headers: { 'X-User-Token': token },
    });
    if (!res.ok) throw new Error('Failed to fetch channels');
    return res.json();
  },

  async getSubscriptions(token: string): Promise<{ sourceIds: number[] }> {
    const res = await fetch(`${API_BASE}/subscriptions`, {
      headers: { 'X-User-Token': token },
    });
    if (!res.ok) throw new Error('Failed to fetch subscriptions');
    return res.json();
  },

  async updateSubscriptions(token: string, sourceIds: number[]): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': token,
      },
      body: JSON.stringify({ sourceIds }),
    });
    if (!res.ok) throw new Error('Failed to update subscriptions');
    return res.json();
  },

  async getDigest(token: string, period: 'day' | 'week' = 'day'): Promise<DigestResponse> {
    const res = await fetch(`${API_BASE}/digest?period=${period}`, {
      headers: { 'X-User-Token': token },
    });
    if (!res.ok) throw new Error('Failed to fetch digest');
    return res.json();
  },

  async getBookmarks(token: string): Promise<{ articles: any[] }> {
    const res = await fetch(`${API_BASE}/bookmarks`, {
      headers: { 'X-User-Token': token },
    });
    if (!res.ok) throw new Error('Failed to fetch bookmarks');
    return res.json();
  },

  async addBookmark(token: string, articleId: number): Promise<void> {
    await fetch(`${API_BASE}/bookmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Token': token },
      body: JSON.stringify({ articleId }),
    });
  },

  async removeBookmark(token: string, articleId: number): Promise<void> {
    await fetch(`${API_BASE}/bookmarks/${articleId}`, {
      method: 'DELETE',
      headers: { 'X-User-Token': token },
    });
  },
};

// История чтения — IndexedDB + in-memory кэш для мгновенного отображения при навигации
import { db } from './db';

const _readCache = new Set<number>();
let _cacheLoaded = false;

export const readHistoryApi = {
  getReadIdsSync(): Set<number> {
    return new Set(_readCache);
  },

  async markRead(articleId: number): Promise<void> {
    _readCache.add(articleId);
    await db.readArticles.put({ articleId, readAt: Date.now() });
  },

  async getReadIds(): Promise<Set<number>> {
    if (!_cacheLoaded) {
      const rows = await db.readArticles.toArray();
      rows.forEach(r => _readCache.add(r.articleId));
      _cacheLoaded = true;
    }
    return new Set(_readCache);
  },

  // Удаляем записи старше 30 дней чтобы не раздувать IndexedDB
  async gc(): Promise<void> {
    const cutoff = Date.now() - 30 * 86400_000;
    await db.readArticles.where('readAt').below(cutoff).delete();
  },
};
