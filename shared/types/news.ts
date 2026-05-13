// shared/types/news.ts

export const NEWS_REGIONS = ['russia', 'world'] as const;
export const NEWS_CATEGORIES = ['economy', 'tech', 'politics', 'society', 'other'] as const;

export type NewsRegion = typeof NEWS_REGIONS[number];
export type NewsCategory = typeof NEWS_CATEGORIES[number];

export interface NewsSource {
  id: number;
  name: string;
  url: string;
  rssUrl: string;
  region: NewsRegion;
  category: NewsCategory;
  city: string | null;
  isActive: boolean;
  lastFetchedAt: string | null;
  createdAt: string;
}

export interface NewsCluster {
  id: number;
  title: string;
  articleCount: number;
  region: NewsRegion;
  category: NewsCategory;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface NewsArticle {
  id: number;
  sourceId: number | null;
  sourceName: string;
  /** Город источника (если источник городской); иначе null/отсутствует */
  sourceCity?: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  url: string;
  publishedAt: string;
  fetchedAt: string;
  region: NewsRegion;
  category: NewsCategory;
  clusterId: number | null;
  isArchived: boolean;
  createdAt: string;
}

export interface NewsArticleWithCluster extends NewsArticle {
  cluster: NewsCluster | null;
  clusterArticles: NewsArticle[];
}

// API request/response types

export interface NewsListParams {
  region?: NewsRegion | 'all';
  category?: NewsCategory | NewsCategory[] | 'all';
  city?: string;
  date?: string; // ISO date string YYYY-MM-DD
  dateFrom?: string; // ISO date string YYYY-MM-DD
  dateTo?: string; // ISO date string YYYY-MM-DD
  /**
   * Смещение пользователя относительно UTC в минутах (new Date().getTimezoneOffset()).
   * Нужно для корректной фильтрации "календарного дня" без сдвига на +1/-1 день.
   */
  tzOffsetMinutes?: number;
  page?: number;
  limit?: number;
  search?: string;
  /**
   * Server-side gate for feed composition.
   * 1/0 (или true/false) значения передаются как query параметры.
   */
  enabledRussia?: boolean;
  enabledWorld?: boolean;
  enabledCities?: boolean;
  sourceIds?: number[];
}

export interface NewsListResponse {
  articles: NewsArticleWithCluster[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface NewsClusterResponse {
  cluster: NewsCluster;
  articles: NewsArticle[];
}

export interface NewsSearchResponse {
  articles: NewsArticle[];
  total: number;
  query: string;
  limited: boolean;
}

export interface NewsDetailResponse {
  /** Основная статья */
  article: NewsArticle;
  /** Другие статьи из того же кластера (без текущей) — блок «Сравнить источники» */
  clusterSources: NewsArticle[];
  /** Все статьи по горячей теме (entity-движок или cluster) — блок «Похожие новости» */
  similarArticles: NewsArticle[];
  /** Свежие из той же категории, макс 3 — блок «Другие новости» (если similarArticles пустой) */
  otherArticles: NewsArticle[];
}
