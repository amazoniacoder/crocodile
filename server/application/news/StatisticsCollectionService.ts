import { collectionStatRepository } from '../../infrastructure/persistence/CollectionStatRepository';
import { newsSourceRepository } from '../../infrastructure/persistence/NewsSourceRepository';
import type { RssCollectionResult } from './RssCollectionService';
import type { ArticlePersistenceResult } from './ArticleManagementService';

export interface CollectionStatistics {
  sourceId: number;
  sourceName: string;
  articlesInserted: number;
  articlesDuplicate: number;
  fetchDurationMs: number;
  avgLatencyMs: number | null;
  errorCount: number;
  lastError: string | null;
  timestamp: Date;
}

export interface AggregatedStats {
  totalSources: number;
  activeSources: number;
  totalArticles: number;
  totalDuplicates: number;
  totalErrors: number;
  averageFetchTime: number;
  averageLatency: number | null;
  successRate: number;
}

/**
 * Сервис для сбора и управления статистикой с единственной ответственностью
 * 
 * Отвечает только за:
 * - Запись статистики циклов сбора
 * - Агрегацию метрик производительности
 * - Расчет показателей успешности
 * - Очистку старой статистики
 */
export class StatisticsCollectionService {
  /**
   * Записывает статистику успешного сбора
   */
  async recordSuccessfulCollection(
    sourceId: number,
    rssResult: RssCollectionResult,
    persistenceResult: ArticlePersistenceResult
  ): Promise<void> {
    try {
      await collectionStatRepository.insert({
        sourceId,
        articlesInserted: persistenceResult.insertedCount,
        articlesDuplicate: persistenceResult.duplicateCount,
        fetchDurationMs: rssResult.fetchDurationMs,
        avgLatencyMs: rssResult.avgLatencyMs,
        errorCount: 0,
        lastError: null,
      });
    } catch (error) {
      console.error('Failed to record successful collection stats:', error);
      // Не прерываем процесс сбора из-за ошибки статистики
    }
  }

  /**
   * Записывает статистику неудачного сбора
   */
  async recordFailedCollection(
    sourceId: number,
    fetchDurationMs: number,
    error: string
  ): Promise<void> {
    try {
      await collectionStatRepository.insert({
        sourceId,
        articlesInserted: 0,
        articlesDuplicate: 0,
        fetchDurationMs,
        avgLatencyMs: null,
        errorCount: 1,
        lastError: error,
      });
    } catch (dbError) {
      console.error('Failed to record failed collection stats:', dbError);
      // Не прерываем процесс сбора из-за ошибки статистики
    }
  }

  /**
   * Записывает статистику rate-limited запроса
   */
  async recordRateLimitedCollection(
    sourceId: number,
    fetchDurationMs: number,
    reason: string
  ): Promise<void> {
    await this.recordFailedCollection(
      sourceId,
      fetchDurationMs,
      `Rate limited: ${reason}`
    );
  }

  /**
   * Записывает статистику пустой ленты
   */
  async recordEmptyFeedCollection(
    sourceId: number,
    fetchDurationMs: number
  ): Promise<void> {
    await this.recordFailedCollection(
      sourceId,
      fetchDurationMs,
      'Пустая лента'
    );
  }

  /**
   * Получает детальную статистику по источникам за период
   */
  async getDetailedStats(hours: number = 24): Promise<CollectionStatistics[]> {
    try {
      const aggregated = await collectionStatRepository.aggregateLast24h(hours);
      const sources = await newsSourceRepository.findAll();
      
      const sourceMap = new Map(sources.map(s => [s.id, s.name]));
      
      return aggregated.map(stat => ({
        sourceId: stat.sourceId || 0,
        sourceName: sourceMap.get(stat.sourceId || 0) || 'Unknown',
        articlesInserted: stat.totalInserted,
        articlesDuplicate: stat.totalDuplicate,
        fetchDurationMs: stat.avgFetchDurationMs || 0,
        avgLatencyMs: stat.avgLatencyMs,
        errorCount: stat.errorCount,
        lastError: stat.lastError,
        timestamp: stat.lastCollectedAt || new Date()
      }));
    } catch (error) {
      console.error('Failed to get detailed stats:', error);
      return [];
    }
  }

  /**
   * Получает агрегированную статистику за период
   */
  async getAggregatedStats(hours: number = 24): Promise<AggregatedStats> {
    try {
      const aggregated = await collectionStatRepository.aggregateLast24h(hours);
      const allSources = await newsSourceRepository.findAll();
      const activeSources = await newsSourceRepository.findAllActive();
      
      if (aggregated.length === 0) {
        return {
          totalSources: allSources.length,
          activeSources: activeSources.length,
          totalArticles: 0,
          totalDuplicates: 0,
          totalErrors: 0,
          averageFetchTime: 0,
          averageLatency: null,
          successRate: 0
        };
      }

      const totalArticles = aggregated.reduce((sum, s) => sum + s.totalInserted, 0);
      const totalDuplicates = aggregated.reduce((sum, s) => sum + s.totalDuplicate, 0);
      const totalErrors = aggregated.reduce((sum, s) => sum + s.errorCount, 0);
      const totalSources = aggregated.length;
      const successfulSources = aggregated.filter(s => s.errorCount === 0).length;
      
      const averageFetchTime = Math.round(
        aggregated.reduce((sum, s) => sum + (s.avgFetchDurationMs || 0), 0) / aggregated.length
      );
      
      const latencies = aggregated
        .map(s => s.avgLatencyMs)
        .filter((l): l is number => l !== null);
      
      const averageLatency = latencies.length > 0
        ? Math.round(latencies.reduce((sum, l) => sum + l, 0) / latencies.length)
        : null;
      
      const successRate = totalSources > 0
        ? Math.round((successfulSources / totalSources) * 100)
        : 0;

      return {
        totalSources: allSources.length,
        activeSources: activeSources.length,
        totalArticles,
        totalDuplicates,
        totalErrors,
        averageFetchTime,
        averageLatency,
        successRate
      };
    } catch (error) {
      console.error('Failed to get aggregated stats:', error);
      return {
        totalSources: 0,
        activeSources: 0,
        totalArticles: 0,
        totalDuplicates: 0,
        totalErrors: 0,
        averageFetchTime: 0,
        averageLatency: null,
        successRate: 0
      };
    }
  }

  /**
   * Получает статистику по конкретному источнику
   */
  async getSourceStats(sourceId: number, hours: number = 24): Promise<{
    totalCollections: number;
    successfulCollections: number;
    totalArticles: number;
    totalDuplicates: number;
    averageFetchTime: number;
    averageLatency: number | null;
    lastError: string | null;
    successRate: number;
  }> {
    try {
      const stats = await collectionStatRepository.findBySource(sourceId, 100);
      
      if (stats.length === 0) {
        return {
          totalCollections: 0,
          successfulCollections: 0,
          totalArticles: 0,
          totalDuplicates: 0,
          averageFetchTime: 0,
          averageLatency: null,
          lastError: null,
          successRate: 0
        };
      }

      // Фильтруем по времени
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      const recentStats = stats.filter(s => s.collectedAt >= since);
      
      if (recentStats.length === 0) {
        return {
          totalCollections: 0,
          successfulCollections: 0,
          totalArticles: 0,
          totalDuplicates: 0,
          averageFetchTime: 0,
          averageLatency: null,
          lastError: null,
          successRate: 0
        };
      }

      const totalCollections = recentStats.length;
      const successfulCollections = recentStats.filter(s => s.errorCount === 0).length;
      const totalArticles = recentStats.reduce((sum, s) => sum + s.articlesInserted, 0);
      const totalDuplicates = recentStats.reduce((sum, s) => sum + s.articlesDuplicate, 0);
      
      const averageFetchTime = Math.round(
        recentStats.reduce((sum, s) => sum + (s.fetchDurationMs || 0), 0) / recentStats.length
      );
      
      const latencies = recentStats
        .map(s => s.avgLatencyMs)
        .filter((l): l is number => l !== null);
      
      const averageLatency = latencies.length > 0
        ? Math.round(latencies.reduce((sum, l) => sum + l, 0) / latencies.length)
        : null;
      
      const lastErrorStat = recentStats
        .filter(s => s.lastError)
        .sort((a, b) => b.collectedAt.getTime() - a.collectedAt.getTime())[0];
      
      const successRate = Math.round((successfulCollections / totalCollections) * 100);

      return {
        totalCollections,
        successfulCollections,
        totalArticles,
        totalDuplicates,
        averageFetchTime,
        averageLatency,
        lastError: lastErrorStat?.lastError || null,
        successRate
      };
    } catch (error) {
      console.error(`Failed to get stats for source ${sourceId}:`, error);
      return {
        totalCollections: 0,
        successfulCollections: 0,
        totalArticles: 0,
        totalDuplicates: 0,
        averageFetchTime: 0,
        averageLatency: null,
        lastError: null,
        successRate: 0
      };
    }
  }

  /**
   * Очищает старую статистику
   */
  async cleanupOldStats(daysOld: number = 7): Promise<number> {
    try {
      return await collectionStatRepository.deleteOlderThan(daysOld);
    } catch (error) {
      console.error('Failed to cleanup old stats:', error);
      return 0;
    }
  }

  /**
   * Получает топ источников по производительности
   */
  async getTopPerformingSources(hours: number = 24, limit: number = 10): Promise<Array<{
    sourceId: number;
    sourceName: string;
    totalArticles: number;
    successRate: number;
    averageFetchTime: number;
  }>> {
    try {
      const aggregated = await collectionStatRepository.aggregateLast24h(hours);
      const sources = await newsSourceRepository.findAll();
      
      const sourceMap = new Map(sources.map(s => [s.id, s.name]));

      // Преобразуем в массив и сортируем
      const result = aggregated
        .filter(stat => stat.sourceId !== null)
        .map(stat => ({
          sourceId: stat.sourceId!,
          sourceName: sourceMap.get(stat.sourceId!) || 'Unknown',
          totalArticles: stat.totalInserted,
          successRate: stat.errorCount === 0 ? 100 : 0,
          averageFetchTime: stat.avgFetchDurationMs || 0
        }))
        .sort((a, b) => {
          // Сортируем по количеству статей, затем по успешности
          if (a.totalArticles !== b.totalArticles) {
            return b.totalArticles - a.totalArticles;
          }
          return b.successRate - a.successRate;
        })
        .slice(0, limit);

      return result;
    } catch (error) {
      console.error('Failed to get top performing sources:', error);
      return [];
    }
  }
}

// Singleton instance
export const statisticsCollectionService = new StatisticsCollectionService();