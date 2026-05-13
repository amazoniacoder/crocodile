import type { NewsArticle, NewArticleInput, NewsRegion, NewsCategory } from './NewsArticle';
import type { NewsCluster, NewClusterInput } from './NewsCluster';
import type { NewsSource, NewSourceInput } from './NewsSource';

// ─── NewsArticle ─────────────────────────────────────────────────────────────

export interface NewsArticleFilters {
  region?: NewsRegion | 'all';
  category?: NewsCategory | NewsCategory[] | 'all';
  city?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  tzOffsetMinutes?: number;
  isArchived?: boolean;
  sourceType?: 'rss' | 'telegram' | 'youtube';
  channelUsername?: string;
  /**
   * Server-side gate for "приём" новостей.
   * Если параметр false — такие новости не попадают в выдачу и не учитываются в total.
   */
  enabledRussia?: boolean;
  enabledWorld?: boolean;
  enabledCities?: boolean;
  sourceIds?: number[];
}

export interface INewsArticleRepository {
  insert(article: NewArticleInput): Promise<NewsArticle | null>;
  findUnclustered(since: Date): Promise<NewsArticle[]>;
  assignCluster(articleIds: number[], clusterId: number): Promise<void>;
  archiveOlderThan(date: Date): Promise<number>;
  deleteOlderThan(date: Date): Promise<number>;
  findMany(filters: NewsArticleFilters, page: number, limit: number): Promise<{ articles: NewsArticle[]; total: number }>;
  findByClusterId(clusterId: number): Promise<NewsArticle[]>;
  search(query: string, limit: number, gate?: Pick<NewsArticleFilters, 'enabledRussia' | 'enabledWorld' | 'enabledCities'>): Promise<NewsArticle[]>;
  countSince(since: Date): Promise<number>;
}

// ─── NewsSource ──────────────────────────────────────────────────────────────

export interface INewsSourceRepository {
  findAllActive(): Promise<NewsSource[]>;
  findAll(): Promise<NewsSource[]>;
  findById(id: number): Promise<NewsSource | null>;
  insert(source: NewSourceInput): Promise<NewsSource>;
  update(id: number, fields: Partial<NewSourceInput & { isActive: boolean; lastFetchedAt: Date }>): Promise<NewsSource | null>;
  getActiveCities(): Promise<string[]>;
  countActive(): Promise<number>;
  getLastFetchedAt(): Promise<Date | null>;
}

// ─── NewsCluster ─────────────────────────────────────────────────────────────

export interface INewsClusterRepository {
  insert(cluster: NewClusterInput): Promise<NewsCluster>;
  findById(id: number): Promise<NewsCluster | null>;
  countSince(since: Date): Promise<number>;
}
