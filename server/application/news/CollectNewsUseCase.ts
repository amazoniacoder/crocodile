import { newsSourceRepository } from '../../infrastructure/persistence/NewsSourceRepository';
import { eventBus } from '../../infrastructure/events/EventBus';
import { loadBalancer } from '../../infrastructure/cluster/LoadBalancer';
import { RssCollectionService } from './RssCollectionService';
import { ArticleManagementService } from './ArticleManagementService';
import { ScheduleManagementService } from './ScheduleManagementService';
import { StatisticsCollectionService } from './StatisticsCollectionService';
import { 
  rssArticlesCollected, 
  rssCollectionDuration, 
  rssCollectionErrors,
  rssCollectionLastSuccess 
} from '../../infrastructure/monitoring/PrometheusMetrics';
import type { NewsSource } from '../../domain/news/NewsSource';

const SOURCE_DELAY_MS = 500;

/**
 * Рефакторенный Use Case для сбора новостей с разделением ответственности
 * 
 * Координирует работу специализированных сервисов:
 * - RssCollectionService: сбор RSS-лент
 * - ArticleManagementService: управление статьями
 * - ScheduleManagementService: управление расписанием
 * - StatisticsCollectionService: сбор статистики
 */
class CollectNewsUseCase {
  private readonly rssService = new RssCollectionService();
  private readonly articleService = new ArticleManagementService();
  private readonly scheduleService = new ScheduleManagementService();
  private readonly statsService = new StatisticsCollectionService();

  /**
   * Инициализация системы сбора новостей
   */
  async initialize(): Promise<void> {
    await this.scheduleService.initialize();
    
    // Запускаем расписание с обработчиками
    this.scheduleService.startSchedule(
      () => this.execute('fast'),
      () => this.execute('slow')
    );
    
    // Первый запуск через 5 секунд
    setTimeout(() => this.execute('all'), 5000);
    
    const scheduleInfo = this.scheduleService.getScheduleInfo();
    console.log(`📰 News collector initialized (fast: ${scheduleInfo.fastCronExpression}, slow: ${scheduleInfo.slowCronExpression})`);
  }

  /**
   * Перезагрузка расписания из базы данных
   */
  async reloadCronFromDb(): Promise<void> {
    await this.scheduleService.reloadFromDatabase(
      () => this.execute('fast'),
      () => this.execute('slow')
    );
    
    const scheduleInfo = this.scheduleService.getScheduleInfo();
    console.log(`📰 Cron reloaded (fast: ${scheduleInfo.fastCronExpression}, slow: ${scheduleInfo.slowCronExpression})`);
  }

  /**
   * Остановка системы сбора
   */
  stop(): void {
    this.scheduleService.stopSchedule();
    console.log('📰 News collector stopped');
  }

  /**
   * Основной метод выполнения сбора новостей
   */
  async execute(group: 'fast' | 'slow' | 'all' | 'telegram' | 'youtube' = 'all'): Promise<void> {
    const startTime = Date.now();
    
    // Проверяем, не выполняется ли уже цикл
    if (this.scheduleService.isCycleRunning()) {
      console.log('📰 Collection cycle already running, skipping');
      return;
    }
    
    // В кластерном режиме проверяем, должна ли эта нода обрабатывать сбор
    if (group !== 'all' && group !== 'telegram' && group !== 'youtube') {
      const shouldHandle = await loadBalancer.shouldHandleCollection(group);
      if (!shouldHandle) {
        console.log(`📰 Skipping ${group} collection - handled by another node`);
        return;
      }
    }
    
    const sources = await this.getSourcesToProcess(group);
    if (sources.length === 0) {
      console.log('📰 No sources to process');
      return;
    }

    // Начинаем цикл сбора
    this.scheduleService.startCycle(sources.length);
    let totalInserted = 0;

    try {
      totalInserted = await this.processSources(sources);
      
      if (totalInserted > 0) {
        const nodeInfo = await loadBalancer.getClusterHealth();
        console.log(`📰 Collected ${totalInserted} new articles (node: ${nodeInfo.currentNode})`);
      }
      
      // Prometheus метрики
      const durationSeconds = (Date.now() - startTime) / 1000;
      rssCollectionDuration.observe(durationSeconds);
      rssCollectionLastSuccess.setToCurrentTime();
      
      // Освобождаем блокировку для кластера
      if (group !== 'all' && group !== 'telegram' && group !== 'youtube') {
        await loadBalancer.releaseCollectionLock(group);
      }
      
      // Эмитим событие для кластеризации и уведомлений
      this.emitCollectionEvent(totalInserted);
      
    } catch (error) {
      console.error('📰 Collection cycle error:', error);
      
      // Prometheus метрика ошибки
      rssCollectionErrors.inc({
        source: 'batch',
        error_type: error instanceof Error ? error.name : 'unknown'
      });
    } finally {
      this.scheduleService.finishCycle();
    }
  }

  /**
   * Получение источников для обработки по группе
   */
  private async getSourcesToProcess(group: 'fast' | 'slow' | 'all' | 'telegram' | 'youtube'): Promise<NewsSource[]> {
    const allSources = await newsSourceRepository.findAllActive();
    console.log(`[CollectNewsUseCase] Group: ${group}, All sources: ${allSources.length}`);
    
    if (group === 'telegram') {
      const filtered = allSources.filter(s => s.sourceType === 'telegram');
      console.log(`[CollectNewsUseCase] Telegram sources: ${filtered.length}`);
      return filtered;
    }
    if (group === 'youtube') {
      const filtered = allSources.filter(s => s.sourceType === 'youtube');
      console.log(`[CollectNewsUseCase] YouTube sources: ${filtered.length}`);
      return filtered;
    }
    const filtered = this.rssService.filterSourcesByGroup(allSources, group);
    console.log(`[CollectNewsUseCase] Filtered sources for ${group}: ${filtered.length}`);
    return filtered;
  }

  /**
   * Обработка списка источников
   */
  private async processSources(sources: NewsSource[]): Promise<number> {
    let totalInserted = 0;

    for (const [index, source] of sources.entries()) {
      // Обновляем прогресс
      this.scheduleService.updateCycleProgress(index + 1, source.name);
      
      try {
        const insertedCount = await this.processSource(source);
        totalInserted += insertedCount;
      } catch (error) {
        console.error(`📰 Failed to process source ${source.name}:`, error);
        // Продолжаем обработку других источников
      }
      
      // Задержка между источниками
      await this.delay(SOURCE_DELAY_MS);
    }

    return totalInserted;
  }

  /**
   * Обработка одного источника
   */
  private async processSource(source: NewsSource): Promise<number> {
    console.log(`[CollectNewsUseCase] Processing source: ${source.name} (${source.sourceType}, private: ${source.isPrivate})`);
    
    // Собираем RSS
    const rssResult = await this.rssService.collectFromSource(source);
    
    // Обрабатываем rate limiting
    if (rssResult.rateLimited) {
      await this.statsService.recordRateLimitedCollection(
        source.id,
        rssResult.fetchDurationMs,
        rssResult.error || 'Rate limited'
      );
      
      // Prometheus метрика ошибки
      rssCollectionErrors.inc({
        source: source.name,
        error_type: 'rate_limited'
      });
      
      // Ждем время retry
      if (rssResult.retryAfter) {
        await this.delay(Math.min(rssResult.retryAfter * 1000, SOURCE_DELAY_MS));
      }
      
      return 0;
    }
    
    // Обрабатываем ошибки сбора
    if (rssResult.error) {
      await this.statsService.recordFailedCollection(
        source.id,
        rssResult.fetchDurationMs,
        rssResult.error
      );
      
      // Prometheus метрика ошибки
      rssCollectionErrors.inc({
        source: source.name,
        error_type: this.rssService.isNetworkError(rssResult.error) ? 'network' : 'parse'
      });
      
      if (this.rssService.isNetworkError(rssResult.error)) {
        console.warn(`📰 Source unavailable (network): ${source.name}`);
      } else {
        console.error(`📰 Failed to fetch ${source.name}: ${rssResult.error}`);
      }
      
      return 0;
    }
    
    // Обрабатываем пустую ленту
    if (rssResult.articles.length === 0) {
      console.warn(`📰 Empty feed: ${source.name} (${source.rssUrl})`);
      await this.statsService.recordEmptyFeedCollection(
        source.id,
        rssResult.fetchDurationMs
      );
      return 0;
    }
    
    // Сохраняем статьи
    const persistenceResult = await this.articleService.persistArticles(rssResult.articles);
    
    // Обновляем метаданные источника (для Telegram)
    if (rssResult.feedMeta) {
      const needsUpdate = 
        rssResult.feedMeta.description !== source.description ||
        rssResult.feedMeta.logoUrl !== source.logoUrl;
      
      if (needsUpdate) {
        await newsSourceRepository.update(source.id, {
          description: rssResult.feedMeta.description,
          logoUrl: rssResult.feedMeta.logoUrl,
        });
      }
    }
    
    // Обрабатываем сущности для новых статей
    if (persistenceResult.insertedArticles.length > 0) {
      await this.articleService.processEntities(persistenceResult.insertedArticles);
    }
    
    // Обновляем время последнего сбора
    await newsSourceRepository.update(source.id, { 
      lastFetchedAt: new Date() 
    });
    
    // Записываем статистику успешного сбора
    await this.statsService.recordSuccessfulCollection(
      source.id,
      rssResult,
      persistenceResult
    );
    
    // Prometheus метрика успешного сбора
    rssArticlesCollected.inc({
      source: source.name,
      region: source.region,
      category: source.category
    }, persistenceResult.insertedCount);
    
    return persistenceResult.insertedCount;
  }

  /**
   * Эмиссия события о завершении сбора
   */
  private emitCollectionEvent(insertedCount: number): void {
    eventBus.emit('articles.collected', {
      type: 'articles.collected',
      occurredAt: new Date(),
      articles: [],
      sourceId: 0,
      sourceName: 'batch',
      insertedCount,
    });
  }

  /**
   * Задержка выполнения
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Геттеры для обратной совместимости с существующим API
  get lastCycleDurationMs(): number | null {
    return this.scheduleService.getCycleMetrics().lastCycleDurationMs;
  }

  get lastCycleAt(): Date | null {
    return this.scheduleService.getCycleMetrics().lastCycleAt;
  }

  get cycleStartedAt(): Date | null {
    return this.scheduleService.getCycleMetrics().cycleStartedAt;
  }

  get nextCycleAt(): Date | null {
    return this.scheduleService.getScheduleInfo().nextCycleAt;
  }

  get nextFastCycleAt(): Date | null {
    return this.scheduleService.getScheduleInfo().nextFastCycleAt;
  }

  get nextSlowCycleAt(): Date | null {
    return this.scheduleService.getScheduleInfo().nextSlowCycleAt;
  }

  get currentSourceName(): string | null {
    return this.scheduleService.getCycleMetrics().currentSourceName;
  }

  get currentSourceIndex(): number | null {
    return this.scheduleService.getCycleMetrics().currentSourceIndex;
  }

  get totalSourcesInCycle(): number {
    return this.scheduleService.getCycleMetrics().totalSourcesInCycle;
  }

  refreshNextCycleAt(): void {
    // Метод для обратной совместимости - теперь расписание обновляется автоматически
  }
}

export const collectNewsUseCase = new CollectNewsUseCase();
