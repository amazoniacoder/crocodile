import Dexie, { type Table } from 'dexie';
import type { NewsArticleWithCluster, NewsDetailResponse } from '@shared/types/news';

export interface FeedSlice {
  key: string;
  articleIds: number[];
  lastSyncedAt: number;
}

export interface ArticleDetailRecord {
  articleId: number;
  data: NewsDetailResponse;
  savedAt: number;
}

export interface PendingAction {
  id?: number;
  type: 'react' | 'emotion';
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;
  status: 'pending' | 'failed';
}

export interface ReadArticle {
  articleId: number;
  readAt: number;
}

export interface BookmarkRecord {
  articleId: number;
  savedAt: number;
  data: NewsArticleWithCluster;
}

class NewsDb extends Dexie {
  articles!: Table<NewsArticleWithCluster, number>;
  feedSlices!: Table<FeedSlice, string>;
  articleDetails!: Table<ArticleDetailRecord, number>;
  pendingActions!: Table<PendingAction, number>;
  readArticles!: Table<ReadArticle, number>;
  bookmarks!: Table<BookmarkRecord, number>;

  constructor() {
    super('news-aggregator-offline');
    this.version(1).stores({
      articles: 'id, publishedAt, region, category, sourceId, clusterId',
      feedSlices: 'key, lastSyncedAt',
      articleDetails: 'articleId, savedAt',
      pendingActions: '++id, status, createdAt',
    });
    this.version(2).stores({
      articles: 'id, publishedAt, region, category, sourceId, clusterId',
      feedSlices: 'key, lastSyncedAt',
      articleDetails: 'articleId, savedAt',
      pendingActions: '++id, status, createdAt',
      readArticles: 'articleId, readAt',
    });
    this.version(3).stores({
      articles: 'id, publishedAt, region, category, sourceId, clusterId',
      feedSlices: 'key, lastSyncedAt',
      articleDetails: 'articleId, savedAt',
      pendingActions: '++id, status, createdAt',
      readArticles: 'articleId, readAt',
      bookmarks: 'articleId, savedAt',
    });
  }
}

export const db = new NewsDb();
