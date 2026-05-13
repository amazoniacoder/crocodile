import { parseSourceFeed } from '../../infrastructure/rss/RssParser';
import { rssRateLimiter } from '../../infrastructure/rss/RssRateLimiter';
import type { NewsSource } from '../../domain/news/NewsSource';
import type { NewArticleInput } from '../../domain/news/NewsArticle';

const SOURCE_FETCH_TIMEOUT_MS = 8000;
const LATENCY_ANOMALY_MS = 6 * 60 * 60 * 1000;

export interface RssCollectionResult {
  articles: NewArticleInput[];
  fetchDurationMs: number;
  avgLatencyMs: number | null;
  feedMeta?: {
    description: string | null;
    logoUrl: string | null;
  };
  error?: string;
  rateLimited?: boolean;
  retryAfter?: number;
}

/**
 * Сервис для сбора RSS-лент с единственной ответственностью
 * 
 * Отвечает только за:
 * - Получение статей из RSS-источника
 * - Обработку rate limiting
 * - Расчет метрик производительности
 * - Обработку ошибок сети
 */
export class RssCollectionService {
  /**
   * Собирает статьи из одного RSS-источника
   */
  async collectFromSource(source: NewsSource): Promise<RssCollectionResult> {
    const fetchStart = Date.now();
    const domain = this.getDomainFromUrl(source.rssUrl);
    
    // Проверяем rate limiting
    const rateLimitResult = await rssRateLimiter.canMakeRequest(domain);
    
    if (!rateLimitResult.allowed) {
      return {
        articles: [],
        fetchDurationMs: Date.now() - fetchStart,
        avgLatencyMs: null,
        error: `Rate limited: ${rateLimitResult.reason}`,
        rateLimited: true,
        retryAfter: rateLimitResult.retryAfter || 60
      };
    }

    try {
      const { articles, feedMeta } = await this.withTimeout(
        parseSourceFeed(source),
        SOURCE_FETCH_TIMEOUT_MS,
        source.name
      );
      
      const fetchedAt = new Date();
      const fetchDurationMs = Date.now() - fetchStart;
      const avgLatencyMs = this.calculateAverageLatency(articles, fetchedAt);
      
      // Записываем успешный запрос для rate limiting
      await rssRateLimiter.recordRequest(domain);
      
      return {
        articles,
        fetchDurationMs,
        avgLatencyMs,
        feedMeta
      };
      
    } catch (error: any) {
      const errorMessage = this.classifyError(error);
      const fetchDurationMs = Date.now() - fetchStart;
      
      // Записываем ошибку для rate limiting
      await rssRateLimiter.recordError(domain, errorMessage);
      
      return {
        articles: [],
        fetchDurationMs,
        avgLatencyMs: null,
        error: errorMessage
      };
    }
  }

  /**
   * Проверяет, является ли источник "быстрым" (опрашивается чаще)
   */
  isFastSource(source: NewsSource): boolean {
    const FAST_DOMAINS = [
      'localhost',
      'lenta.ru',
      'rbc.ru',
      'habr.com',
      'youtube.com',
      'primamedia.ru',
      'dvhab.ru',
      'amur.info',
      'nord-news.ru',
      'poluostrov-kamchatka.ru',
    ];
    
    return FAST_DOMAINS.some(domain => source.rssUrl.includes(domain));
  }

  /**
   * Фильтрует источники по группе (fast/slow)
   */
  filterSourcesByGroup(sources: NewsSource[], group: 'fast' | 'slow' | 'all'): NewsSource[] {
    if (group === 'all') return sources;
    if (group === 'fast') return sources.filter(s => this.isFastSource(s));
    return sources.filter(s => !this.isFastSource(s));
  }

  /**
   * Извлекает домен из URL для rate limiting
   */
  private getDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Обертка для добавления таймаута к промису
   */
  private async withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: NodeJS.Timeout | null = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
      });
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Рассчитывает среднюю задержку между публикацией и получением статей
   */
  private calculateAverageLatency(
    articles: { publishedAt: Date; fetchedAt?: Date }[], 
    fetchedAt: Date
  ): number | null {
    const latencies: number[] = [];
    
    for (const article of articles) {
      const publishedAt = article.publishedAt instanceof Date 
        ? article.publishedAt 
        : new Date(article.publishedAt);
      
      const diff = fetchedAt.getTime() - publishedAt.getTime();
      
      // Фильтруем аномальные значения
      if (diff >= 0 && diff <= LATENCY_ANOMALY_MS) {
        latencies.push(diff);
      }
    }
    
    if (latencies.length === 0) return null;
    
    return Math.round(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length);
  }

  /**
   * Классифицирует ошибки для удобного отображения
   */
  private classifyError(error: any): string {
    const message = (
      error?.message ||
      error?.code ||
      error?.cause?.message ||
      (typeof error === 'string' ? error : '') ||
      JSON.stringify(error) ||
      'Unknown error'
    ).slice(0, 500);

    if (message.includes('503')) return 'Заблокировано (503)';
    if (message.includes('404')) return 'Не найдено (404)';
    if (message.includes('401') || message.includes('403')) return 'Доступ запрещён';
    if (message.includes('ECONNREFUSED')) return 'Соединение отклонено';
    if (message.includes('ENOTFOUND')) return 'Хост недоступен';
    if (message.includes('ETIMEDOUT') || message.includes('timed out')) return 'Таймаут';
    if (message.includes('ECONNRESET')) return 'Соединение сброшено';
    if (message.includes('Invalid XML') || message.includes('Non-whitespace')) return 'Невалидный XML';
    
    return message.slice(0, 100);
  }

  /**
   * Проверяет, является ли ошибка сетевой блокировкой
   */
  isNetworkError(error: string): boolean {
    return error.includes('ENOTFOUND') ||
           error.includes('ECONNREFUSED') ||
           error.includes('timed out');
  }
}

// Singleton instance
export const rssCollectionService = new RssCollectionService();