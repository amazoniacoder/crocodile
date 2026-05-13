import { newsArticleRepository } from '../../infrastructure/persistence/NewsArticleRepository';
import { userSubscriptionRepository } from '../../infrastructure/persistence/UserSubscriptionRepository';
import { newsSourceRepository } from '../../infrastructure/persistence/NewsSourceRepository';
import type { NewsArticleFilters } from '../../domain/news/repositories';

export class PersonalFeedService {
  async getPersonalFeed(
    tokenId: number,
    filters: Omit<NewsArticleFilters, 'sourceIds'> & { q?: string },
    page: number,
    limit: number
  ) {
    let sourceIds = await userSubscriptionRepository.findByTokenId(tokenId);
    
    if (sourceIds.length === 0) return { articles: [], total: 0 };

    // Фильтруем sourceIds по sourceType до запроса
    if (filters.sourceType) {
      const sources = await newsSourceRepository.findAll();
      
      const filteredIds = sources
        .filter(s => s.sourceType === filters.sourceType && s.isActive && sourceIds.includes(s.id))
        .map(s => s.id);
      
      if (filteredIds.length === 0) return { articles: [], total: 0 };
      sourceIds = filteredIds;
    }

    if (filters.q?.trim()) {
      const results = await newsArticleRepository.search(filters.q.trim(), 200);
      let filtered = results.filter(a => a.sourceId != null && sourceIds.includes(a.sourceId));

      // Постфильтрация по дате при поиске
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        filtered = filtered.filter(a => new Date(a.publishedAt) >= from);
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setDate(to.getDate() + 1);
        filtered = filtered.filter(a => new Date(a.publishedAt) < to);
      }

      const offset = (page - 1) * limit;
      return {
        articles: filtered.slice(offset, offset + limit),
        total: filtered.length,
      };
    }

    // Передаем фильтры без sourceType — он уже применён через sourceIds
    const { sourceType, ...restFilters } = filters;
    return newsArticleRepository.findMany({ ...restFilters, sourceIds }, page, limit);
  }

  async getDigest(tokenId: number, period: 'day' | 'week') {
    const sourceIds = await userSubscriptionRepository.findByTokenId(tokenId);
    if (sourceIds.length === 0) return { newCount: 0, topArticles: [], period };

    const since = new Date(Date.now() - (period === 'week' ? 7 : 1) * 86400000);

    const { articles, total } = await newsArticleRepository.findMany(
      { sourceIds, isArchived: false },
      1,
      5
    );

    // Количество новых за период
    const { articles: periodArticles } = await newsArticleRepository.findMany(
      { sourceIds, isArchived: false },
      1,
      200
    );
    const newCount = periodArticles.filter(a => new Date(a.publishedAt) >= since).length;

    const sourceMap = await newsArticleRepository.findSourceDisplay(
      [...new Set(articles.map(a => a.sourceId).filter(Boolean))] as number[]
    );

    const sources = await newsSourceRepository.findAll();
    const sourceTypeMap = new Map(sources.map(s => [s.id, s.sourceType]));

    const topArticles = articles.map(a => {
      const src = a.sourceId != null ? sourceMap.get(a.sourceId) : undefined;
      return {
        id: a.id,
        title: a.title,
        url: a.url,
        publishedAt: a.publishedAt,
        sourceName: src?.name ?? 'Unknown',
        sourceLogoUrl: src?.logoUrl ?? null,
        sourceType: a.sourceId != null ? (sourceTypeMap.get(a.sourceId) ?? 'rss') : 'rss',
        likesCount: a.likesCount,
      };
    });

    return { newCount, topArticles, period };
  }
}

export const personalFeedService = new PersonalFeedService();
