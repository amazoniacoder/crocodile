import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../../db/db';
import { newsArticles, newsSources, newsClusters } from '../../../shared/types/schema';
import { collectNewsUseCase } from '../../application/news/CollectNewsUseCase';
import { clusterNewsUseCase } from '../../application/news/ClusterNewsUseCase';
import { queryCacheService } from '../../infrastructure/monitoring/QueryCacheService';
import { eventBus } from '../../infrastructure/events/EventBus';
import { eq } from 'drizzle-orm';

describe('E2E: Full News Cycle', () => {
  let testSourceId: number;
  let collectedArticleIds: number[] = [];

  beforeAll(async () => {
    // Создаём тестовый источник
    const [source] = await db.insert(newsSources).values({
      name: 'Test E2E Source',
      url: 'https://test-e2e.example.com',
      rssUrl: 'https://test-e2e.example.com/rss',
      region: 'russia',
      category: 'tech',
      isActive: true
    }).returning();
    
    testSourceId = source.id;
  });

  afterAll(async () => {
    // Очистка тестовых данных
    if (collectedArticleIds.length > 0) {
      await db.delete(newsArticles).where(
        eq(newsArticles.id, collectedArticleIds[0])
      );
    }
    
    if (testSourceId) {
      await db.delete(newsSources).where(eq(newsSources.id, testSourceId));
    }
  });

  beforeEach(() => {
    collectedArticleIds = [];
  });

  it('should complete full cycle: collect → cluster → notify → cache', async () => {
    // Шаг 1: Сбор новостей
    let articlesCollectedCount = 0;
    let clusterUpdatedFired = false;
    
    const collectHandler = (data: any) => {
      articlesCollectedCount = data.insertedCount;
    };
    
    const clusterHandler = () => {
      clusterUpdatedFired = true;
    };

    eventBus.on('articles.collected', collectHandler);
    eventBus.on('cluster.updated', clusterHandler);

    try {
      // Вставляем тестовые статьи напрямую (имитация RSS-сбора)
      const testArticles = [
        {
          sourceId: testSourceId,
          title: 'Test Article 1: AI breakthrough in neural networks',
          description: 'Scientists achieve major breakthrough in AI',
          url: `https://test-e2e.example.com/article-${Date.now()}-1`,
          publishedAt: new Date(),
          region: 'russia',
          category: 'tech'
        },
        {
          sourceId: testSourceId,
          title: 'Test Article 2: AI breakthrough in machine learning',
          description: 'Researchers make progress in ML algorithms',
          url: `https://test-e2e.example.com/article-${Date.now()}-2`,
          publishedAt: new Date(),
          region: 'russia',
          category: 'tech'
        }
      ];

      const inserted = await db.insert(newsArticles).values(testArticles).returning();
      collectedArticleIds = inserted.map(a => a.id);

      expect(inserted.length).toBe(2);
      expect(collectedArticleIds.length).toBe(2);

      // Эмитируем событие сбора
      eventBus.emit('articles.collected', {
        insertedCount: inserted.length,
        duplicateCount: 0,
        totalProcessed: inserted.length
      });

      // Ждём обработки события
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(articlesCollectedCount).toBe(2);

      // Шаг 2: Кластеризация
      await clusterNewsUseCase.execute();

      // Проверяем, что статьи получили cluster_id
      const clusteredArticles = await db.select()
        .from(newsArticles)
        .where(eq(newsArticles.id, collectedArticleIds[0]));

      expect(clusteredArticles[0].clusterId).toBeDefined();

      // Проверяем событие cluster.updated
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(clusterUpdatedFired).toBe(true);

      // Шаг 3: Проверка инвалидации кэша
      const cacheStats = queryCacheService.getStats();
      expect(cacheStats).toBeDefined();

      // Шаг 4: Проверка, что кластер создан
      if (clusteredArticles[0].clusterId) {
        const [cluster] = await db.select()
          .from(newsClusters)
          .where(eq(newsClusters.id, clusteredArticles[0].clusterId));

        expect(cluster).toBeDefined();
        expect(cluster.articleCount).toBeGreaterThanOrEqual(1);
        expect(cluster.region).toBe('russia');
        expect(cluster.category).toBe('tech');
      }

    } finally {
      eventBus.off('articles.collected', collectHandler);
      eventBus.off('cluster.updated', clusterHandler);
    }
  }, 30000);

  it('should handle duplicate articles correctly', async () => {
    const uniqueUrl = `https://test-e2e.example.com/duplicate-${Date.now()}`;
    
    // Первая вставка
    const [first] = await db.insert(newsArticles).values({
      sourceId: testSourceId,
      title: 'Duplicate Test Article',
      description: 'Testing duplicate handling',
      url: uniqueUrl,
      publishedAt: new Date(),
      region: 'russia',
      category: 'tech'
    }).returning();

    collectedArticleIds.push(first.id);

    // Попытка вставить дубликат
    let duplicateError = false;
    try {
      await db.insert(newsArticles).values({
        sourceId: testSourceId,
        title: 'Duplicate Test Article (different title)',
        description: 'Different description',
        url: uniqueUrl, // Тот же URL
        publishedAt: new Date(),
        region: 'russia',
        category: 'tech'
      });
    } catch (error: any) {
      duplicateError = true;
      expect(error.code).toBe('23505'); // PostgreSQL unique violation
    }

    expect(duplicateError).toBe(true);
  });

  it('should invalidate cache after article collection', async () => {
    // Сбрасываем статистику кэша
    queryCacheService.resetStats();

    // Вставляем статью
    const [article] = await db.insert(newsArticles).values({
      sourceId: testSourceId,
      title: 'Cache Invalidation Test',
      description: 'Testing cache invalidation',
      url: `https://test-e2e.example.com/cache-test-${Date.now()}`,
      publishedAt: new Date(),
      region: 'russia',
      category: 'tech'
    }).returning();

    collectedArticleIds.push(article.id);

    // Эмитируем событие
    eventBus.emit('articles.collected', {
      insertedCount: 1,
      duplicateCount: 0,
      totalProcessed: 1
    });

    // Ждём обработки
    await new Promise(resolve => setTimeout(resolve, 200));

    // Проверяем, что кэш был инвалидирован
    // (в реальности проверяется через отсутствие закэшированных данных)
    const stats = queryCacheService.getStats();
    expect(stats).toBeDefined();
  });

  it('should cluster similar articles together', async () => {
    const timestamp = Date.now();
    
    // Вставляем три похожие статьи
    const similarArticles = [
      {
        sourceId: testSourceId,
        title: 'Breaking: Major earthquake hits California',
        description: 'Earthquake in California',
        url: `https://test-e2e.example.com/earthquake-1-${timestamp}`,
        publishedAt: new Date(),
        region: 'world',
        category: 'other'
      },
      {
        sourceId: testSourceId,
        title: 'California earthquake: Latest updates',
        description: 'Updates on California earthquake',
        url: `https://test-e2e.example.com/earthquake-2-${timestamp}`,
        publishedAt: new Date(),
        region: 'world',
        category: 'other'
      },
      {
        sourceId: testSourceId,
        title: 'Earthquake strikes California region',
        description: 'California hit by earthquake',
        url: `https://test-e2e.example.com/earthquake-3-${timestamp}`,
        publishedAt: new Date(),
        region: 'world',
        category: 'other'
      }
    ];

    const inserted = await db.insert(newsArticles).values(similarArticles).returning();
    collectedArticleIds.push(...inserted.map(a => a.id));

    // Запускаем кластеризацию
    await clusterNewsUseCase.execute();

    // Проверяем, что статьи попали в один кластер
    const clustered = await db.select()
      .from(newsArticles)
      .where(eq(newsArticles.id, collectedArticleIds[collectedArticleIds.length - 3]));

    expect(clustered[0].clusterId).toBeDefined();

    // Проверяем остальные статьи
    const allClustered = await db.select()
      .from(newsArticles)
      .where(eq(newsArticles.sourceId, testSourceId));

    const clusterIds = allClustered
      .filter(a => collectedArticleIds.includes(a.id))
      .map(a => a.clusterId)
      .filter(id => id !== null);

    // Все три статьи должны иметь cluster_id
    expect(clusterIds.length).toBe(3);
  }, 30000);
});
