export const NEWS_REGIONS = ['russia', 'world'] as const;
export const NEWS_CATEGORIES = ['economy', 'tech', 'politics', 'society', 'other'] as const;

export type NewsRegion = typeof NEWS_REGIONS[number];
export type NewsCategory = typeof NEWS_CATEGORIES[number];

export interface NewsArticle {
  id: number;
  sourceId: number | null;
  sourceName?: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  url: string;
  publishedAt: Date;
  fetchedAt: Date;
  region: NewsRegion;
  category: NewsCategory;
  clusterId: number | null;
  isArchived: boolean;
  createdAt: Date;
  likesCount: number;
  dislikesCount: number;
  sourceType?: 'rss' | 'telegram' | 'youtube';
  channelUsername?: string | null;
  messageId?: number | null;
  videoId?: string | null;
}

/** Статья ещё не сохранённая в БД — без id и служебных полей */
export type NewArticleInput = Omit<NewsArticle, 'id' | 'clusterId' | 'isArchived' | 'createdAt' | 'fetchedAt' | 'sourceName' | 'likesCount' | 'dislikesCount'>;

export function isValidRegion(value: string): value is NewsRegion {
  return (NEWS_REGIONS as readonly string[]).includes(value);
}

export function isValidCategory(value: string): value is NewsCategory {
  return (NEWS_CATEGORIES as readonly string[]).includes(value);
}

/** Статья считается устаревшей если опубликована более N дней назад */
export function isStale(article: Pick<NewsArticle, 'publishedAt'>, days: number): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return article.publishedAt < cutoff;
}
