/**
 * Circuit Breaker Pattern Implementation
 * 
 * Защищает систему от каскадных отказов при недоступности внешних сервисов.
 * Автоматически переключается между состояниями CLOSED → OPEN → HALF_OPEN.
 */

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Количество неудач для перехода в OPEN состояние */
  failureThreshold: number;
  /** Время ожидания в OPEN состоянии (мс) */
  timeout: number;
  /** Период мониторинга для сброса счетчика неудач (мс) */
  monitoringPeriod: number;
  /** Количество успешных запросов в HALF_OPEN для перехода в CLOSED */
  successThreshold: number;
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  lastFailTime: number;
  lastSuccessTime: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  uptime: number;
}

export class CircuitBreakerError extends Error {
  constructor(message: string, public readonly state: CircuitBreakerState) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailTime = 0;
  private lastSuccessTime = 0;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private readonly startTime = Date.now();

  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: 5,
      timeout: 60000, // 1 минута
      monitoringPeriod: 10000, // 10 секунд
      successThreshold: 3,
      ...options
    };
  }

  /**
   * Выполнение операции с защитой Circuit Breaker
   */
  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Проверяем состояние перед выполнением
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        this.successes = 0;
      } else {
        const error = new CircuitBreakerError(
          `Circuit breaker is OPEN. Service unavailable for ${Math.round((Date.now() - this.lastFailTime) / 1000)}s`,
          'OPEN'
        );
        
        if (fallback) {
          console.warn(`Circuit breaker OPEN, using fallback: ${error.message}`);
          return await fallback();
        }
        
        throw error;
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      if (fallback && this.state !== 'CLOSED') {
        console.warn(`Circuit breaker opened, using fallback:`, error);
        return await fallback();
      }
      
      throw error;
    }
  }

  /**
   * Обработка успешного выполнения
   */
  private onSuccess(): void {
    this.successes++;
    this.totalSuccesses++;
    this.lastSuccessTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      if (this.successes >= this.options.successThreshold) {
        this.reset();
      }
    } else if (this.state === 'CLOSED') {
      // Сбрасываем счетчик неудач при успешном выполнении
      if (this.shouldResetFailures()) {
        this.failures = 0;
      }
    }
  }

  /**
   * Обработка неудачного выполнения
   */
  private onFailure(): void {
    this.failures++;
    this.totalFailures++;
    this.lastFailTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // В HALF_OPEN любая неудача возвращает в OPEN
      this.state = 'OPEN';
      this.successes = 0;
    } else if (this.state === 'CLOSED') {
      // Переходим в OPEN при превышении порога
      if (this.failures >= this.options.failureThreshold) {
        this.state = 'OPEN';
        this.successes = 0;
      }
    }
  }

  /**
   * Сброс Circuit Breaker в исходное состояние
   */
  private reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
  }

  /**
   * Проверка необходимости попытки сброса (OPEN → HALF_OPEN)
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailTime >= this.options.timeout;
  }

  /**
   * Проверка необходимости сброса счетчика неудач
   */
  private shouldResetFailures(): boolean {
    return Date.now() - this.lastFailTime >= this.options.monitoringPeriod;
  }

  /**
   * Получение текущих метрик
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailTime: this.lastFailTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Получение статистики в удобном формате
   */
  getStats() {
    const metrics = this.getMetrics();
    const successRate = metrics.totalRequests > 0 
      ? (metrics.totalSuccesses / metrics.totalRequests * 100).toFixed(2)
      : '0.00';

    return {
      state: metrics.state,
      successRate: `${successRate}%`,
      totalRequests: metrics.totalRequests,
      currentFailures: metrics.failures,
      uptime: `${Math.round(metrics.uptime / 1000)}s`,
      lastFailure: metrics.lastFailTime > 0 
        ? `${Math.round((Date.now() - metrics.lastFailTime) / 1000)}s ago`
        : 'never',
      lastSuccess: metrics.lastSuccessTime > 0
        ? `${Math.round((Date.now() - metrics.lastSuccessTime) / 1000)}s ago`
        : 'never'
    };
  }

  /**
   * Принудительный сброс Circuit Breaker (для админ-панели)
   */
  forceReset(): void {
    this.reset();
    console.log('🔄 Circuit breaker manually reset');
  }

  /**
   * Принудительное открытие Circuit Breaker (для тестирования)
   */
  forceOpen(): void {
    this.state = 'OPEN';
    this.lastFailTime = Date.now();
    console.log('🚫 Circuit breaker manually opened');
  }

  /**
   * Проверка доступности сервиса
   */
  isAvailable(): boolean {
    return this.state !== 'OPEN';
  }
}

/**
 * Фабрика для создания Circuit Breaker с предустановленными конфигурациями
 */
export class CircuitBreakerFactory {
  /**
   * Circuit Breaker для HTTP API сервисов
   */
  static forHttpService(serviceName: string): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 5,
      timeout: 30000, // 30 секунд
      monitoringPeriod: 60000, // 1 минута
      successThreshold: 2
    });
  }

  /**
   * Circuit Breaker для критичных внешних сервисов
   */
  static forCriticalService(serviceName: string): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 3,
      timeout: 60000, // 1 минута
      monitoringPeriod: 30000, // 30 секунд
      successThreshold: 3
    });
  }

  /**
   * Circuit Breaker для некритичных сервисов
   */
  static forOptionalService(serviceName: string): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 10,
      timeout: 120000, // 2 минуты
      monitoringPeriod: 300000, // 5 минут
      successThreshold: 1
    });
  }
}