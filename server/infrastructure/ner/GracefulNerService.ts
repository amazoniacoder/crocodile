import { nerService } from '../ner/NerService';
import { logger } from '../../utils/logger';
import type { ArticleEntities } from '../ner/NerService';

export interface GracefulNerOptions {
  enableFallback: boolean;
  fallbackStrategy: 'empty' | 'simple' | 'keyword';
  maxRetries: number;
  retryDelay: number;
}

export interface NerProcessingResult {
  success: boolean;
  entities: ArticleEntities | null;
  fallbackUsed: boolean;
  processingTime: number;
  error?: string;
}

/**
 * Сервис для graceful degradation NER обработки
 * 
 * Обеспечивает работу системы даже при недоступности NER сервиса
 * через различные fallback стратегии
 */
export class GracefulNerService {
  private readonly options: GracefulNerOptions;
  private nerAvailable = true;
  private lastNerCheck = 0;
  private readonly checkInterval = 60000; // 1 минута

  constructor(options: Partial<GracefulNerOptions> = {}) {
    this.options = {
      enableFallback: true,
      fallbackStrategy: 'simple',
      maxRetries: 2,
      retryDelay: 1000,
      ...options
    };
  }

  /**
   * Обработка сущностей с graceful degradation
   */
  async processEntities(
    articles: Array<{ id: number; title: string }>
  ): Promise<Map<number, NerProcessingResult>> {
    const results = new Map<number, NerProcessingResult>();
    
    // Проверяем доступность NER сервиса
    await this.checkNerAvailability();
    
    if (this.nerAvailable) {
      // Пытаемся использовать основной NER сервис
      try {
        const startTime = Date.now();
        const entitiesMap = await this.processWithRetries(articles);
        const processingTime = Date.now() - startTime;
        
        // Записываем результаты успешной обработки
        for (const article of articles) {
          const entities = entitiesMap.get(article.id) || null;
          results.set(article.id, {
            success: true,
            entities,
            fallbackUsed: false,
            processingTime: processingTime / articles.length
          });
        }
        
        logger.info(`✅ NER processing successful for ${articles.length} articles`);
        return results;
        
      } catch (error) {
        logger.warn('🔄 NER service failed, switching to fallback mode:', error);
        this.nerAvailable = false;
        this.lastNerCheck = Date.now();
      }
    }
    
    // Используем fallback стратегию
    if (this.options.enableFallback) {
      return this.processFallback(articles);
    }
    
    // Возвращаем пустые результаты если fallback отключен
    for (const article of articles) {
      results.set(article.id, {
        success: false,
        entities: null,
        fallbackUsed: false,
        processingTime: 0,
        error: 'NER service unavailable and fallback disabled'
      });
    }
    
    return results;
  }

  /**
   * Обработка с повторными попытками
   */
  private async processWithRetries(
    articles: Array<{ id: number; title: string }>
  ): Promise<Map<number, ArticleEntities | null>> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await nerService.extractEntitiesForArticles(articles);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.options.maxRetries) {
          const delay = this.options.retryDelay * attempt;
          logger.warn(`NER attempt ${attempt} failed, retrying in ${delay}ms:`, error);
          await this.delay(delay);
        }
      }
    }
    
    throw lastError || new Error('NER processing failed after retries');
  }

  /**
   * Fallback обработка сущностей
   */
  private async processFallback(
    articles: Array<{ id: number; title: string }>
  ): Promise<Map<number, NerProcessingResult>> {
    const results = new Map<number, NerProcessingResult>();
    const startTime = Date.now();
    
    for (const article of articles) {
      const entities = await this.extractFallbackEntities(article.title);
      const processingTime = Date.now() - startTime;
      
      results.set(article.id, {
        success: true,
        entities,
        fallbackUsed: true,
        processingTime: processingTime / articles.length
      });
    }
    
    logger.info(`🔄 Fallback NER processing completed for ${articles.length} articles using ${this.options.fallbackStrategy} strategy`);
    return results;
  }

  /**
   * Извлечение сущностей через fallback стратегии
   */
  private async extractFallbackEntities(title: string): Promise<ArticleEntities | null> {
    switch (this.options.fallbackStrategy) {
      case 'empty':
        return this.emptyFallback();
        
      case 'simple':
        return this.simpleFallback(title);
        
      case 'keyword':
        return this.keywordFallback(title);
        
      default:
        return this.emptyFallback();
    }
  }

  /**
   * Пустой fallback - возвращает пустые массивы
   */
  private emptyFallback(): ArticleEntities {
    return {
      PER: [],
      ORG: [],
      LOC: []
    };
  }

  /**
   * Простой fallback - базовое извлечение по паттернам
   */
  private simpleFallback(title: string): ArticleEntities {
    const entities: ArticleEntities = {
      PER: [],
      ORG: [],
      LOC: []
    };

    // Простые паттерны для русского языка
    const personPatterns = [
      /([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+)/g, // Имя Фамилия
      /([А-ЯЁ]\.\s*[А-ЯЁ]\.\s*[А-ЯЁ][а-яё]+)/g, // И.О. Фамилия
    ];

    const orgPatterns = [
      /(ООО|АО|ПАО|ЗАО|ИП)\s+[«"]?([А-ЯЁа-яё\s\-]+)[«"]?/g,
      /([А-ЯЁ][А-ЯЁ\s]{2,})/g, // Аббревиатуры
    ];

    const locationPatterns = [
      /(г\.\s*[А-ЯЁ][а-яё\-]+)/g, // г. Москва
      /([А-ЯЁ][а-яё\-]+(?:ск|град|бург|город))/g, // Петербург, Новгород
    ];

    // Извлекаем персоны
    for (const pattern of personPatterns) {
      const matches = title.match(pattern);
      if (matches) {
        entities.PER.push(...matches.map(m => m.trim()));
      }
    }

    // Извлекаем организации
    for (const pattern of orgPatterns) {
      const matches = title.match(pattern);
      if (matches) {
        entities.ORG.push(...matches.map(m => m.trim()));
      }
    }

    // Извлекаем локации
    for (const pattern of locationPatterns) {
      const matches = title.match(pattern);
      if (matches) {
        entities.LOC.push(...matches.map(m => m.trim()));
      }
    }

    // Удаляем дубликаты и ограничиваем количество
    entities.PER = [...new Set(entities.PER)].slice(0, 3);
    entities.ORG = [...new Set(entities.ORG)].slice(0, 3);
    entities.LOC = [...new Set(entities.LOC)].slice(0, 3);

    return entities;
  }

  /**
   * Keyword fallback - извлечение по ключевым словам
   */
  private keywordFallback(title: string): ArticleEntities {
    const entities: ArticleEntities = {
      PER: [],
      ORG: [],
      LOC: []
    };

    // Словари известных сущностей
    const knownPersons = [
      'Путин', 'Байден', 'Трамп', 'Зеленский', 'Лукашенко',
      'Медведев', 'Лавров', 'Песков', 'Собянин', 'Мишустин'
    ];

    const knownOrgs = [
      'Газпром', 'Роснефть', 'Сбербанк', 'ВТБ', 'Лукойл',
      'Яндекс', 'Mail.ru', 'Тинькофф', 'МТС', 'Мегафон',
      'ФСБ', 'МВД', 'МИД', 'Минфин', 'ЦБ', 'Кремль'
    ];

    const knownLocations = [
      'Москва', 'Петербург', 'Санкт-Петербург', 'Казань', 'Екатеринбург',
      'Новосибирск', 'Челябинск', 'Омск', 'Самара', 'Ростов',
      'Россия', 'США', 'Украина', 'Белоруссия', 'Китай', 'Германия'
    ];

    // Поиск известных сущностей в заголовке
    const titleLower = title.toLowerCase();

    for (const person of knownPersons) {
      if (titleLower.includes(person.toLowerCase())) {
        entities.PER.push(person);
      }
    }

    for (const org of knownOrgs) {
      if (titleLower.includes(org.toLowerCase())) {
        entities.ORG.push(org);
      }
    }

    for (const location of knownLocations) {
      if (titleLower.includes(location.toLowerCase())) {
        entities.LOC.push(location);
      }
    }

    return entities;
  }

  /**
   * Проверка доступности NER сервиса
   */
  private async checkNerAvailability(): Promise<void> {
    const now = Date.now();
    
    // Проверяем не чаще раза в минуту
    if (now - this.lastNerCheck < this.checkInterval) {
      return;
    }
    
    this.lastNerCheck = now;
    
    try {
      const healthCheck = await nerService.healthCheck();
      this.nerAvailable = healthCheck.available;
      
      if (this.nerAvailable) {
        logger.info('✅ NER service is available');
      } else {
        logger.warn('⚠️ NER service health check failed:', healthCheck.error);
      }
    } catch (error) {
      this.nerAvailable = false;
      logger.warn('⚠️ NER service health check error:', error);
    }
  }

  /**
   * Получение статистики graceful degradation
   */
  getStats(): {
    nerAvailable: boolean;
    fallbackEnabled: boolean;
    fallbackStrategy: string;
    lastCheck: Date | null;
  } {
    return {
      nerAvailable: this.nerAvailable,
      fallbackEnabled: this.options.enableFallback,
      fallbackStrategy: this.options.fallbackStrategy,
      lastCheck: this.lastNerCheck > 0 ? new Date(this.lastNerCheck) : null
    };
  }

  /**
   * Принудительная проверка NER сервиса
   */
  async forceHealthCheck(): Promise<boolean> {
    this.lastNerCheck = 0; // Сбрасываем кэш
    await this.checkNerAvailability();
    return this.nerAvailable;
  }

  /**
   * Включение/выключение fallback режима
   */
  setFallbackEnabled(enabled: boolean): void {
    this.options.enableFallback = enabled;
    logger.info(`🔄 Graceful NER fallback ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Изменение fallback стратегии
   */
  setFallbackStrategy(strategy: GracefulNerOptions['fallbackStrategy']): void {
    this.options.fallbackStrategy = strategy;
    logger.info(`🔄 Graceful NER fallback strategy changed to: ${strategy}`);
  }

  /**
   * Задержка выполнения
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const gracefulNerService = new GracefulNerService({
  enableFallback: true,
  fallbackStrategy: 'simple',
  maxRetries: 2,
  retryDelay: 1000
});