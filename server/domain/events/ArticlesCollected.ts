import type { DomainEvent } from './DomainEvent';
import type { NewsArticle } from '../news/NewsArticle';

export interface ArticlesCollected extends DomainEvent {
  readonly type: 'articles.collected';
  readonly articles: NewsArticle[];
  readonly sourceId: number;
  readonly sourceName: string;
  readonly insertedCount: number;
}
