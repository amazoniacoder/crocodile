import { eventBus } from '../../infrastructure/events/EventBus';
import { newsArticleRepository } from '../../infrastructure/persistence/NewsArticleRepository';
import { newsClusterRepository } from '../../infrastructure/persistence/NewsClusterRepository';
import { tokenizeNormalized, MIN_COMMON_WORDS } from '../../domain/news/NewsCluster';
import { nerService } from '../../infrastructure/ner/NerService';
import type { NewsArticle } from '../../domain/news/NewsArticle';

const CLUSTER_WINDOW_HOURS = 2;

class ClusterNewsUseCase {
  initialize(): void {
    eventBus.on('articles.collected', async () => {
      await this.execute();
    });
  }

  async execute(): Promise<{ clustersCreated: number; singles: number }> {
    try {
      const windowStart = new Date();
      windowStart.setHours(windowStart.getHours() - CLUSTER_WINDOW_HOURS);

      const unclustered = await newsArticleRepository.findUnclustered(windowStart);

      // Даже если нечего кластеризовать — новые статьи уже в БД, кэш и WS должны сработать
      if (unclustered.length === 0) {
        eventBus.emit('cluster.updated', { type: 'cluster.updated', occurredAt: new Date(), clustersCreated: 0, singlesCount: 0 });
        return { clustersCreated: 0, singles: 0 };
      }

      if (unclustered.length === 1) {
        eventBus.emit('cluster.updated', { type: 'cluster.updated', occurredAt: new Date(), clustersCreated: 0, singlesCount: 1 });
        return { clustersCreated: 0, singles: 1 };
      }

      const groups = await this.groupBySimilarity(unclustered);
      let clustersCreated = 0;

      for (const group of groups) {
        if (group.length < 2) continue;

        const cluster = await newsClusterRepository.insert({
          title: group[0].title,
          articleCount: group.length,
          region: group[0].region,
          category: group[0].category,
          firstSeenAt: group[group.length - 1].publishedAt,
          lastSeenAt: group[0].publishedAt,
        });

        await newsArticleRepository.assignCluster(group.map(a => a.id), cluster.id);
        clustersCreated++;
      }

      const singles = groups.filter(g => g.length === 1).length;
      console.log(`📰 Clustered: ${clustersCreated} clusters, singles: ${singles}`);

      eventBus.emit('cluster.updated', {
        type: 'cluster.updated',
        occurredAt: new Date(),
        clustersCreated,
        singlesCount: singles,
      });

      return { clustersCreated, singles };
    } catch (error) {
      throw error;
    }
  }

  private async groupBySimilarity(articles: NewsArticle[]): Promise<NewsArticle[][]> {
    const buckets = new Map<string, NewsArticle[]>();
    for (const a of articles) {
      const key = `${a.region}:${a.category}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(a);
    }

    const allGroups: NewsArticle[][] = [];
    for (const bucket of buckets.values()) {
      allGroups.push(...await this.clusterBucket(bucket));
    }
    return allGroups;
  }

  private async clusterBucket(articles: NewsArticle[]): Promise<NewsArticle[][]> {
    // Нормализатор: если NER недоступен — identity (graceful degradation)
    const normalize = nerService.isAvailable()
      ? (tokens: string[]) => nerService.normalizeTokens(tokens)
      : (tokens: string[]) => Promise.resolve(tokens);

    // Нормализуем все заголовки заранее — O(n) запросов вместо O(n²)
    const normalizedSets = await Promise.all(
      articles.map(a => tokenizeNormalized(a.title, normalize))
    );

    const assigned = new Set<number>();
    const groups: NewsArticle[][] = [];

    for (let i = 0; i < articles.length; i++) {
      if (assigned.has(i)) continue;

      const group = [articles[i]];
      assigned.add(i);

      for (let j = i + 1; j < articles.length; j++) {
        if (assigned.has(j)) continue;
        let common = 0;
        for (const word of normalizedSets[i]) {
          if (normalizedSets[j].has(word)) common++;
        }
        if (common >= MIN_COMMON_WORDS) {
          group.push(articles[j]);
          assigned.add(j);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  // Вызывается cron из index.ts
  async archiveOld(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    return newsArticleRepository.archiveOlderThan(cutoff);
  }

  async deleteOld(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    return newsArticleRepository.deleteOlderThan(cutoff);
  }
}

export const clusterNewsUseCase = new ClusterNewsUseCase();
