import { ArticleEntities, nerService } from './NerService';
import { logger } from '../../utils/logger';

interface ArticleForNer {
  id: number;
  title: string;
}

interface BatchMetrics {
  batchSize: number;
  processingTimeMs: number;
  successRate: number;
  timestamp: Date;
}

const MIN_BATCH_SIZE = 5;
const MAX_BATCH_SIZE = 50;
const INITIAL_BATCH_SIZE = 10;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

class NerBatchProcessor {
  private queue: ArticleForNer[] = [];
  private processing = false;
  private metrics: BatchMetrics[] = [];
  private currentBatchSize = INITIAL_BATCH_SIZE;
  private maxMetrics = 100;

  async addToQueue(articles: ArticleForNer[]): Promise<Map<number, ArticleEntities | null>> {
    const resultMap = new Map<number, ArticleEntities | null>();
    
    // Проверяем доступность NER сервиса через Circuit Breaker
    if (!nerService.isAvailable()) {
      logger.warn('🚫 NER service unavailable (Circuit Breaker OPEN), returning empty entities');
      articles.forEach(article => {
        resultMap.set(article.id, null);
      });
      return resultMap;
    }
    
    // Add articles to queue
    this.queue.push(...articles);
    
    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
    
    // Wait for these specific articles to be processed
    return this.waitForArticles(articles.map(a => a.id));
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    try {
      while (this.queue.length > 0) {
        // Проверяем доступность перед каждым батчем
        if (!nerService.isAvailable()) {
          logger.warn('🚫 NER service became unavailable during processing, stopping queue');
          // Помечаем оставшиеся статьи как неудачные
          this.queue.forEach(article => {
            this.storeResult(article.id, null);
          });
          this.queue = [];
          break;
        }
        
        const batchSize = this.calculateOptimalBatchSize();
        const batch = this.queue.splice(0, Math.min(batchSize, this.queue.length));
        
        if (batch.length === 0) break;
        
        await this.processBatch(batch);
        
        // Small delay between batches to prevent overwhelming the NER service
        if (this.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      logger.error('NER batch processing error:', error);
    } finally {
      this.processing = false;
    }
  }

  private async processBatch(batch: ArticleForNer[]): Promise<void> {
    const startTime = Date.now();
    let successCount = 0;
    
    try {
      // Используем NER сервис с Circuit Breaker защитой
      const entitiesMap = await nerService.extractEntitiesForArticles(batch);
      
      // Store results
      batch.forEach((article) => {
        const result = entitiesMap.get(article.id) || null;
        this.storeResult(article.id, result);
        if (result !== null) successCount++;
      });
      
      const processingTime = Date.now() - startTime;
      const successRate = successCount / batch.length;
      
      // Record metrics
      this.recordMetrics({
        batchSize: batch.length,
        processingTimeMs: processingTime,
        successRate,
        timestamp: new Date()
      });
      
      logger.info(`📊 NER batch processed: ${batch.length} articles, ${successCount} successful, ${processingTime}ms`);
      
    } catch (error) {
      logger.error(`❌ NER batch failed: ${batch.length} articles`, error);
      
      // Store null results for failed batch
      batch.forEach(article => {
        this.storeResult(article.id, null);
      });
      
      // Record failed metrics
      this.recordMetrics({
        batchSize: batch.length,
        processingTimeMs: Date.now() - startTime,
        successRate: 0,
        timestamp: new Date()
      });
    }
  }

  private calculateOptimalBatchSize(): number {
    if (this.metrics.length < 3) {
      return this.currentBatchSize;
    }
    
    // Get recent metrics (last 10 batches)
    const recentMetrics = this.metrics.slice(-10);
    
    // Calculate average processing time per article
    const avgTimePerArticle = recentMetrics.reduce((sum, metric) => {
      return sum + (metric.processingTimeMs / metric.batchSize);
    }, 0) / recentMetrics.length;
    
    // Calculate average success rate
    const avgSuccessRate = recentMetrics.reduce((sum, metric) => {
      return sum + metric.successRate;
    }, 0) / recentMetrics.length;
    
    // Adjust batch size based on performance
    let newBatchSize = this.currentBatchSize;
    
    // If processing is fast and successful, increase batch size
    if (avgTimePerArticle < 200 && avgSuccessRate > 0.9) {
      newBatchSize = Math.min(this.currentBatchSize + 5, MAX_BATCH_SIZE);
    }
    // If processing is slow or failing, decrease batch size
    else if (avgTimePerArticle > 500 || avgSuccessRate < 0.7) {
      newBatchSize = Math.max(this.currentBatchSize - 3, MIN_BATCH_SIZE);
    }
    
    // Consider queue length - larger batches for larger queues
    const queueFactor = Math.min(this.queue.length / 50, 2);
    newBatchSize = Math.min(Math.floor(newBatchSize * queueFactor), MAX_BATCH_SIZE);
    
    this.currentBatchSize = Math.max(newBatchSize, MIN_BATCH_SIZE);
    
    return this.currentBatchSize;
  }

  private recordMetrics(metric: BatchMetrics): void {
    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  private resultStore = new Map<number, ArticleEntities | null>();
  private pendingResults = new Map<number, Promise<ArticleEntities | null>>();

  private storeResult(articleId: number, entities: ArticleEntities | null): void {
    this.resultStore.set(articleId, entities);
    
    // Resolve any pending promises for this article
    const resolver = this.pendingResults.get(articleId);
    if (resolver) {
      this.pendingResults.delete(articleId);
    }
  }

  private async waitForArticles(articleIds: number[]): Promise<Map<number, ArticleEntities | null>> {
    const results = new Map<number, ArticleEntities | null>();
    const maxWaitTime = 30000; // 30 seconds max wait
    const startTime = Date.now();
    
    while (results.size < articleIds.length && (Date.now() - startTime) < maxWaitTime) {
      for (const id of articleIds) {
        if (!results.has(id) && this.resultStore.has(id)) {
          results.set(id, this.resultStore.get(id)!);
        }
      }
      
      if (results.size < articleIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Clean up stored results to prevent memory leaks
    for (const id of articleIds) {
      this.resultStore.delete(id);
    }
    
    return results;
  }

  getMetrics(): {
    currentBatchSize: number;
    queueLength: number;
    processing: boolean;
    avgProcessingTime: number;
    avgSuccessRate: number;
    totalProcessed: number;
    nerServiceAvailable: boolean;
    circuitBreakerState: string;
  } {
    const recentMetrics = this.metrics.slice(-10);
    
    const avgProcessingTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.processingTimeMs, 0) / recentMetrics.length
      : 0;
    
    const avgSuccessRate = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.successRate, 0) / recentMetrics.length
      : 0;
    
    const totalProcessed = this.metrics.reduce((sum, m) => sum + m.batchSize, 0);
    const nerMetrics = nerService.getMetrics();
    
    return {
      currentBatchSize: this.currentBatchSize,
      queueLength: this.queue.length,
      processing: this.processing,
      avgProcessingTime: Math.round(avgProcessingTime),
      avgSuccessRate: Math.round(avgSuccessRate * 100) / 100,
      totalProcessed,
      nerServiceAvailable: nerService.isAvailable(),
      circuitBreakerState: nerMetrics.circuitBreakerStats.state
    };
  }

  /**
   * Принудительный сброс Circuit Breaker (для админ-панели)
   */
  resetCircuitBreaker(): void {
    nerService.resetCircuitBreaker();
    logger.info('🔄 NER Circuit Breaker reset via batch processor');
  }

  /**
   * Получение расширенных метрик включая NER сервис
   */
  getDetailedMetrics() {
    return {
      batchProcessor: this.getMetrics(),
      nerService: nerService.getMetrics()
    };
  }
}

export const nerBatchProcessor = new NerBatchProcessor();