// Типы ответов

export interface SourceStat {
  sourceId: number | null;
  sourceName: string;
  region: string | null;
  city: string | null;
  isActive: boolean | null;
  totalInserted: number;
  totalDuplicate: number;
  avgLatencyMs: number | null;
  avgFetchDurationMs: number | null;
  errorCount: number;
  lastCollectedAt: string | null;
  lastError: string | null;
}

export interface ChartPoint {
  sourceId: number | null;
  sourceName: string;
  hour: string;
  articlesInserted: number;
}

export interface TimingPoint {
  collectedAt: string;
  fetchDurationMs: number | null;
}

export interface SystemMetrics {
  memory: { usedMb: number; totalMb: number; freeMb: number; usedPercent: number };
  heap: { usedMb: number; totalMb: number; rssMb: number; usedPercent: number };
  cpu: { avgUsagePercent: number; loadAvg1: number; loadAvg5: number; loadAvg15: number; cores: number; model: string };
  uptime: { serverSec: number; osSec: number };
  node: { version: string; platform: string; tzOffset: number };
  collector: {
    lastCycleDurationMs: number | null;
    lastCycleAt: string | null;
    cycleStartedAt: string | null;
    isRunning: boolean;
    nextCycleAt: string | null;
    nextFastCycleAt: string | null;
    nextSlowCycleAt: string | null;
    currentSourceName: string | null;
    currentSourceIndex: number | null;
    totalSourcesInCycle: number;
  };
}

export interface RecentArticle {
  id: number;
  title: string;
  url: string;
  sourceName: string;
  region: string;
  category: string;
  publishedAt: string;
  fetchedAt: string;
}

export interface SourceConfig {
  key: string;
  value: string;
  updatedAt: string;
}

export interface NewsSource {
  id: number;
  name: string;
  url: string;
  rssUrl: string;
  region: string;
  category: string;
  city: string | null;
  isActive: boolean;
  sourceType: 'rss' | 'telegram' | 'youtube';
  isFeatured?: boolean;
  lastFetchedAt: string | null;
  createdAt: string;
}

export interface AnalyticsSummary {
  pageviews: number;
  clicks: number;
  uniques: number;
}

export interface HourlyPoint {
  hour: string;
  pageviews: number;
  clicks: number;
}

export interface DailyPoint {
  date: string;
  uniques: number;
}

export interface PeakHour {
  hour: number;
  avgEvents: number;
}

export interface TopArticle {
  articleId: number;
  title: string;
  sourceName: string;
  clicks: number;
}

export interface TopSource {
  sourceName: string;
  region: string;
  clicks: number;
}

export interface PushStats {
  enabled: boolean;
  subscriptions: number;
  threshold: number;
}

export interface HotEntity {
  id: number;
  entityText: string;
  entityType: 'PER' | 'ORG' | 'LOC';
  mentionCount: number;
  periodStart: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  requestsPerMinute: number;
  requestsPerDay: number;
}

// API-клиент

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function apiFetch<T>(url: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(token), ...options?.headers } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const adminApi = {
  getRecentArticles: (token: string, hours = 1) =>
    apiFetch<{ articles: RecentArticle[]; hours: number }>(`/api/admin/monitor/recent-articles?hours=${hours}`, token),

  // Monitor
  getRssHub: (token: string) =>
    apiFetch<{ online: boolean }>('/api/admin/monitor/rsshub', token),

  getStats: (token: string, hours = 24) =>
    apiFetch<{ stats: SourceStat[] }>(`/api/admin/monitor/stats?hours=${hours}`, token),

  getChart: (token: string, hours = 24, sourceId?: number) =>
    apiFetch<{ hours: number; data: ChartPoint[] }>(
      `/api/admin/monitor/chart?hours=${hours}${sourceId ? `&sourceId=${sourceId}` : ''}`,
      token
    ),

  getTiming: (token: string, limit = 50) =>
    apiFetch<{ timing: TimingPoint[] }>(`/api/admin/monitor/timing?limit=${limit}`, token),

  getSystem: (token: string) =>
    apiFetch<SystemMetrics>('/api/admin/monitor/system', token),

  // Config
  getConfig: (token: string) =>
    apiFetch<{ configs: SourceConfig[] }>('/api/admin/config', token),

  setConfig: (token: string, key: string, value: string) =>
    apiFetch<{ ok: boolean; key: string; value: string }>('/api/admin/config', token, {
      method: 'PATCH',
      body: JSON.stringify({ key, value }),
    }),

  // Sources CRUD
  getSources: (token: string) =>
    apiFetch<{ sources: NewsSource[] }>('/api/admin/news/sources', token),

  createSource: (token: string, data: Omit<NewsSource, 'id' | 'lastFetchedAt' | 'createdAt'>) =>
    apiFetch<{ source: NewsSource }>('/api/admin/news/sources', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSource: (token: string, id: number, data: Partial<NewsSource>) =>
    apiFetch<{ source: NewsSource }>(`/api/admin/news/sources/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteSource: (token: string, id: number) =>
    apiFetch<{ ok: boolean }>(`/api/admin/news/sources/${id}`, token, { method: 'DELETE' }),

  // Manual collect
  collect: (token: string) =>
    apiFetch<{ ok: boolean; durationMs: number }>('/api/admin/news/collect', token, { method: 'POST' }),

  // Analytics
  getAnalyticsSummary: (token: string, hours = 24) =>
    apiFetch<AnalyticsSummary & { hours: number }>(`/api/admin/analytics/summary?hours=${hours}`, token),

  getAnalyticsHourly: (token: string, hours = 24) =>
    apiFetch<{ hours: number; data: HourlyPoint[] }>(`/api/admin/analytics/hourly?hours=${hours}`, token),

  getAnalyticsDaily: (token: string, days = 30) =>
    apiFetch<{ days: number; data: DailyPoint[] }>(`/api/admin/analytics/daily?days=${days}`, token),

  getAnalyticsPeak: (token: string, days = 7) =>
    apiFetch<{ days: number; data: PeakHour[] }>(`/api/admin/analytics/peak?days=${days}`, token),

  getTopArticles: (token: string, hours = 24, limit = 20) =>
    apiFetch<{ hours: number; data: TopArticle[] }>(`/api/admin/analytics/top-articles?hours=${hours}&limit=${limit}`, token),

  getTopSources: (token: string, hours = 24) =>
    apiFetch<{ hours: number; data: TopSource[] }>(`/api/admin/analytics/top-sources?hours=${hours}`, token),

  getAnalyticsReactions: (token: string, hours = 24, limit = 20) =>
    apiFetch<{
      hours: number;
      likes: number;
      dislikes: number;
      top: { articleId: number; title: string; likes: number; dislikes: number; emotions: Record<string, number> }[];
    }>(`/api/admin/analytics/reactions?hours=${hours}&limit=${limit}`, token),

  getHotEntities: (token: string, hours = 24, limit = 100, type = 'all') =>
    apiFetch<{ hours: number; total: number; data: HotEntity[] }>(
      `/api/admin/analytics/hot-entities?hours=${hours}&limit=${limit}&type=${type}`,
      token
    ),

  deleteAllAnalyticsReactions: (token: string) =>
    apiFetch<{ ok: boolean; deletedReactionRows: number; deletedEmotionRows: number }>(
      '/api/admin/analytics/reactions',
      token,
      { method: 'DELETE' }
    ),

  runHotEntitiesJob: (token: string) =>
    apiFetch<{ success: boolean; data: { entitiesProcessed: number; duration: number } }>(
      '/api/admin/jobs/hot-entities',
      token,
      { method: 'POST' }
    ),

  deleteAllClicks: (token: string) =>
    apiFetch<{ ok: boolean; deletedRows: number }>(
      '/api/admin/analytics/clicks',
      token,
      { method: 'DELETE' }
    ),

  // API Keys
  getApiKeys: (token: string) =>
    apiFetch<{ success: boolean; keys: ApiKey[] }>('/api/admin/api-keys', token),

  createApiKey: (token: string, name: string, requestsPerMinute?: number, requestsPerDay?: number) =>
    apiFetch<{ success: boolean; key: string; id: string }>('/api/admin/api-keys', token, {
      method: 'POST',
      body: JSON.stringify({ name, requestsPerMinute, requestsPerDay }),
    }),

  revokeApiKey: (token: string, id: string) =>
    apiFetch<{ success: boolean }>(`/api/admin/api-keys/${id}`, token, { method: 'DELETE' }),

  getPushStats: (token: string) =>
    apiFetch<{ success: boolean } & PushStats>('/api/push/stats', token),
};
