import type { NewsRegion, NewsCategory } from './NewsArticle';

export interface NewsSource {
  id: number;
  name: string;
  url: string;
  rssUrl: string;
  region: NewsRegion;
  category: NewsCategory;
  city: string | null;
  sourceType: 'rss' | 'telegram' | 'youtube';
  isActive: boolean;
  isFeatured?: boolean;
  isPrivate?: boolean;
  lastFetchedAt: Date | null;
  description: string | null;
  logoUrl: string | null;
  username?: string | null;
  channelId?: string | null;
  createdAt: Date;
}

export type NewSourceInput = Omit<NewsSource, 'id' | 'createdAt' | 'lastFetchedAt' | 'description' | 'logoUrl' | 'isFeatured'> & {
  description?: string | null;
  logoUrl?: string | null;
  isFeatured?: boolean;
};

/** Источник готов к сбору если активен и либо никогда не собирался,
 *  либо последний сбор был более intervalMinutes минут назад */
export function isReadyToFetch(source: NewsSource, intervalMinutes: number): boolean {
  if (!source.isActive) return false;
  if (!source.lastFetchedAt) return true;
  const elapsed = (Date.now() - source.lastFetchedAt.getTime()) / 1000 / 60;
  return elapsed >= intervalMinutes;
}
