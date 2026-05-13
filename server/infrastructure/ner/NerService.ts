import { CircuitBreaker, CircuitBreakerFactory, CircuitBreakerError } from '../patterns/CircuitBreaker';

export interface ArticleEntities {
  PER: string[];
  ORG: string[];
  LOC: string[];
}

interface NerServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  circuitBreakerState: string;
  averageResponseTime: number;
  lastError?: string;
}

class NerService {
  private readonly nerUrl: string;
  private readonly batchSize: number;
  private readonly timeoutMs: number;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly metrics: NerServiceMetrics;
  private responseTimes: number[] = [];

  constructor() {
    this.nerUrl = process.env.NER_SERVICE_URL ?? 'http://ner-service:8001';
    this.batchSize = parseInt(process.env.NER_BATCH_SIZE ?? '10');
    this.timeoutMs = parseInt(process.env.NER_TIMEOUT_MS ?? '5000');
    
    // Circuit Breaker для NER сервиса (некритичный сервис)
    this.circuitBreaker = CircuitBreakerFactory.forOptionalService('NER');
    
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      circuitBreakerState: 'CLOSED',
      averageResponseTime: 0
    };
  }

  /**
   * Извлечение сущностей из батча заголовков с Circuit Breaker защитой
   */
  private async extractBatch(titles: string[]): Promise<(ArticleEntities | null)[]> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const result = await this.circuitBreaker.execute(
        // Основная операция
        async () => {
          const res = await fetch(`${this.nerUrl}/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: titles }),
            signal: AbortSignal.timeout(this.timeoutMs),
          });
          
          if (!res.ok) {
            throw new Error(`NER service responded with status ${res.status}`);
          }
          
          return (await res.json()) as ArticleEntities[];
        },
        // Fallback - возвращаем пустые сущности
        async (): Promise<(ArticleEntities | null)[]> => {
          console.warn('🔄 NER service unavailable, using fallback (empty entities)');
          return titles.map(() => null);
        }
      );

      // Обновляем метрики успеха
      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);
      
      return result;
    } catch (error) {
      // Обновляем метрики ошибки
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime, error);
      
      // Если Circuit Breaker открыт, возвращаем пустые сущности
      if (error instanceof CircuitBreakerError) {
        return titles.map(() => null);
      }
      
      // Для других ошибок тоже возвращаем пустые сущности (graceful degradation)
      console.warn('⚠️ NER extraction failed, returning empty entities:', error);
      return titles.map(() => null);
    }
  }

  /**
   * Обновление метрик производительности
   */
  private updateMetrics(success: boolean, responseTime: number, error?: any): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
      this.metrics.lastError = error?.message || 'Unknown error';
    }

    // Обновляем среднее время ответа (скользящее окно из 100 запросов)
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
    this.metrics.averageResponseTime = 
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;

    // Обновляем состояние Circuit Breaker
    this.metrics.circuitBreakerState = this.circuitBreaker.getMetrics().state;
  }

  /**
   * Извлечение сущностей для массива статей
   */
  async extractEntitiesForArticles(
    articles: Array<{ id: number; title: string }>
  ): Promise<Map<number, ArticleEntities | null>> {
    const result = new Map<number, ArticleEntities | null>();
    
    // Обрабатываем статьи батчами
    for (let i = 0; i < articles.length; i += this.batchSize) {
      const batch = articles.slice(i, i + this.batchSize);
      const entities = await this.extractBatch(batch.map(a => a.title));
      
      // Сопоставляем результаты с ID статей
      batch.forEach((article, idx) => {
        result.set(article.id, entities[idx]);
      });
    }
    
    return result;
  }

  /**
   * Получение метрик сервиса для мониторинга
   */
  getMetrics(): NerServiceMetrics & { circuitBreakerStats: any } {
    return {
      ...this.metrics,
      circuitBreakerStats: this.circuitBreaker.getStats()
    };
  }

  /**
   * Нормализация токенов к именительному падежу через pymorphy2
   * При недоступности NER — возвращает исходные токены (graceful degradation)
   */
  async normalizeTokens(tokens: string[]): Promise<string[]> {
    if (!tokens.length) return tokens;
    try {
      const res = await fetch(`${this.nerUrl}/normalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens }),
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return tokens;
      const data = await res.json() as { tokens: string[] };
      return data.tokens;
    } catch {
      return tokens;
    }
  }

  /**
   * Проверка доступности NER сервиса
   */
  async healthCheck(): Promise<{ available: boolean; responseTime?: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const res = await fetch(`${this.nerUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000), // Короткий таймаут для health check
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        available: res.ok,
        responseTime,
        error: res.ok ? undefined : `HTTP ${res.status}`
      };
    } catch (error) {
      return {
        available: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Принудительный сброс Circuit Breaker (для админ-панели)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.forceReset();
  }

  /**
   * Проверка доступности сервиса через Circuit Breaker
   */
  isAvailable(): boolean {
    return this.circuitBreaker.isAvailable();
  }
}

// Singleton instance
const nerService = new NerService();

// Экспортируем функцию для обратной совместимости
export async function extractEntitiesForArticles(
  articles: Array<{ id: number; title: string }>
): Promise<Map<number, ArticleEntities | null>> {
  return nerService.extractEntitiesForArticles(articles);
}

// Экспортируем сервис для расширенного использования
export { nerService };
