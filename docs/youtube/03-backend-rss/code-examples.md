# Примеры кода для Эпизода 3: "Backend: RSS сбор и обработка"

> **Цель:** Фрагменты реального production-кода для демонстрации RSS сбора

---

## 🚀 CollectNewsUseCase — Оркестрация сбора

Singleton-класс, координирующий все сервисы. Не использует DI-контейнер — зависимости создаются внутри.

```typescript
// server/application/news/CollectNewsUseCase.ts

class CollectNewsUseCase {
  private readonly rssService = new RssCollectionService();
  private readonly articleService = new ArticleManagementService();
  private readonly scheduleService = new ScheduleManagementService();
  private readonly statsService = new StatisticsCollectionService();

  async initialize(): Promise<void> {
    await this.scheduleService.initialize();

    this.scheduleService.startSchedule(
      () => this.execute('fast'),
      () => this.execute('slow')
    );

    // Первый запуск через 5 секунд после старта
    setTimeout(() => this.execute('all'), 5000);
  }

  async execute(group: 'fast' | 'slow' | 'all' | 'telegram' | 'youtube' = 'all'): Promise<void> {
    // Защита от параллельного запуска
    if (this.scheduleService.isCycleRunning()) {
      console.log('📰 Collection cycle already running, skipping');
      return;
    }

    // В кластере — только одна нода выполняет сбор
    if (group !== 'all' && group !== 'telegram' && group !== 'youtube') {
      const shouldHandle = await loadBalancer.shouldHandleCollection(group);
      if (!shouldHandle) return;
    }

    const sources = await this.getSourcesToProcess(group);
    if (sources.length === 0) return;

    this.scheduleService.startCycle(sources.length);
    let totalInserted = 0;

    try {
      totalInserted = await this.processSources(sources);

      // Prometheus метрики
      rssCollectionDuration.observe((Date.now() - startTime) / 1000);
      rssCollectionLastSuccess.setToCurrentTime();

      // Освобождаем Redis-блокировку кластера
      if (group !== 'all' && group !== 'telegram' && group !== 'youtube') {
        await loadBalancer.releaseCollectionLock(group);
      }

      // Событие для кластеризации и WebSocket-уведомлений
      this.emitCollectionEvent(totalInserted);

    } catch (error) {
      rssCollectionErrors.inc({ source: 'batch', error_type: error.name });
    } finally {
      this.scheduleService.finishCycle();
    }
  }
}

export const collectNewsUseCase = new CollectNewsUseCase();
```

**Ключевые особенности:**
- Источники обрабатываются **последовательно** с задержкой 500ms между ними — не параллельно
- Группы `telegram` и `youtube` не участвуют в Redis-блокировке кластера
- Prometheus метрики пишутся напрямую, без AlertManager

---

## 🔄 RssCollectionService — Сбор одного источника

Отвечает только за получение статей из RSS. Не пишет в БД.

```typescript
// server/application/news/RssCollectionService.ts

const SOURCE_FETCH_TIMEOUT_MS = 8000;

export class RssCollectionService {
  async collectFromSource(source: NewsSource): Promise<RssCollectionResult> {
    const fetchStart = Date.now();
    const domain = this.getDomainFromUrl(source.rssUrl);

    // Проверяем rate limiting перед запросом
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
      // Парсинг с жёстким таймаутом 8 секунд
      const { articles, feedMeta } = await this.withTimeout(
        parseSourceFeed(source),
        SOURCE_FETCH_TIMEOUT_MS,
        source.name
      );

      const fetchedAt = new Date();
      await rssRateLimiter.recordRequest(domain);

      return {
        articles,
        fetchDurationMs: Date.now() - fetchStart,
        avgLatencyMs: this.calculateAverageLatency(articles, fetchedAt),
        feedMeta
      };

    } catch (error: any) {
      const errorMessage = this.classifyError(error);
      await rssRateLimiter.recordError(domain, errorMessage);

      return {
        articles: [],
        fetchDurationMs: Date.now() - fetchStart,
        avgLatencyMs: null,
        error: errorMessage
      };
    }
  }

  // Fast-источники опрашиваются каждую минуту
  isFastSource(source: NewsSource): boolean {
    const FAST_DOMAINS = [
      'lenta.ru', 'rbc.ru', 'habr.com', 'youtube.com',
      'primamedia.ru', 'dvhab.ru', 'amur.info',
    ];
    return FAST_DOMAINS.some(domain => source.rssUrl.includes(domain));
  }

  // Классификация ошибок для удобного отображения в мониторинге
  private classifyError(error: any): string {
    const message = (error?.message || '').slice(0, 500);
    if (message.includes('503'))           return 'Заблокировано (503)';
    if (message.includes('ENOTFOUND'))     return 'Хост недоступен';
    if (message.includes('ETIMEDOUT'))     return 'Таймаут';
    if (message.includes('Invalid XML'))   return 'Невалидный XML';
    return message.slice(0, 100);
  }
}
```

---

## 📰 RssParser — Парсинг и нормализация

Не класс, а функция `parseSourceFeed`. Два инстанса парсера на уровне модуля — strict и lenient.

```typescript
// server/infrastructure/rss/RssParser.ts

// Strict-парсер — основной
const parserStrict = new Parser({
  timeout: 5000,
  headers: {
    'User-Agent': 'Mozilla/5.0 ... Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['yt:videoId', 'ytVideoId'],   // YouTube
      ['enclosure', 'enclosure'],
    ],
  },
});

// Lenient-парсер — fallback для региональных сайтов с невалидным XML
const parserLenient = new Parser({
  timeout: 5000,
  xml2js: { strict: false },
  // те же customFields...
});

export async function parseSourceFeed(source: NewsSource): Promise<ParsedFeed> {
  let feed;

  try {
    feed = await parserStrict.parseURL(source.rssUrl);
  } catch (err) {
    // Автоматический fallback только при XML-ошибках
    if (isXmlError(err)) {
      feed = await parserLenient.parseURL(source.rssUrl);
    } else {
      throw err; // Сетевые ошибки пробрасываем наверх
    }
  }

  if (!feed.items?.length) return { articles: [] };

  const articles: NewArticleInput[] = [];

  for (const item of feed.items.slice(0, 50)) { // Максимум 50 статей за цикл
    const url = item.link?.trim();
    const title = item.title?.trim();
    if (!url || !title) continue; // Минимальная валидация

    // Специальная логика RBC: категория из поля newsline
    let region = source.region;
    let category = source.category;
    const newsline = (item as any).newsline;
    if (newsline && source.url.includes('rbc.ru')) {
      const mapped = RBC_NEWSLINE_MAP[newsline];
      if (mapped) { region = mapped.region; category = mapped.category; }
    }

    // Telegram: извлекаем channel_username и message_id из URL
    let channelUsername: string | null = null;
    let messageId: number | null = null;
    if (source.sourceType === 'telegram' && url.includes('t.me/')) {
      const match = url.match(/t\.me\/([^\/]+)\/(\d+)/);
      if (match) { channelUsername = match[1]; messageId = parseInt(match[2], 10); }
    }

    // YouTube: videoId и thumbnail
    let videoId: string | null = null;
    if (source.sourceType === 'youtube') {
      const ytId = (item as any).ytVideoId;
      videoId = ytId ? (Array.isArray(ytId) ? ytId[0] : ytId) : null;
      if (!videoId) {
        const match = url.match(/[?&]v=([^&]+)/);
        if (match) videoId = match[1];
      }
    }

    articles.push({
      sourceId: source.id, title, url,
      description: sanitizeDescription(item.contentSnippet || item.summary),
      imageUrl: extractImageUrl(item),
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      region, category,
      sourceType: source.sourceType || 'rss',
      channelUsername, messageId, videoId,
    });
  }

  return { articles, feedMeta: { description: null, logoUrl: (feed as any).image?.url ?? null } };
}
```

**Важно для видео:** `parseSourceFeed` — чистая функция без побочных эффектов. Не пишет в БД, не эмитит события. Один парсер обрабатывает RSS, Telegram и YouTube — тип источника определяет логику извлечения полей.

---

## 💾 ArticleManagementService — Сохранение статей

Сохраняет статьи по одной, обрабатывает дубликаты через `ON CONFLICT DO NOTHING` на уровне БД.

```typescript
// server/application/news/ArticleManagementService.ts

export class ArticleManagementService {
  async persistArticles(articles: NewArticleInput[]): Promise<ArticlePersistenceResult> {
    let insertedCount = 0;
    let duplicateCount = 0;
    const insertedArticles: Array<{ id: number; title: string }> = [];

    // Последовательная вставка — дубликаты отсеиваются в БД
    for (const article of articles) {
      const savedArticle = await newsArticleRepository.insert(article);

      if (savedArticle) {
        insertedCount++;
        insertedArticles.push({ id: savedArticle.id, title: savedArticle.title });
      } else {
        duplicateCount++; // insert вернул null — URL уже существует
      }
    }

    return { insertedCount, duplicateCount, insertedArticles };
  }

  // После сохранения — NER-обработка для извлечения сущностей
  async processEntities(articles: Array<{ id: number; title: string }>): Promise<void> {
    const { gracefulNerService } = await import('../../infrastructure/ner/GracefulNerService');
    const results = await gracefulNerService.processEntities(articles);

    for (const [articleId, result] of results) {
      if (result.success && result.entities) {
        await newsArticleRepository.updateEntities(articleId, result.entities);
      }
    }
  }
}
```

---

## 🚦 RssRateLimiter — Защита источников

Redis + in-memory двухуровневый rate limiter с per-domain конфигурацией и exponential backoff.

```typescript
// server/infrastructure/rss/RssRateLimiter.ts

export class RssRateLimiter {
  // Разные лимиты для разных доменов
  private readonly DEFAULT_CONFIGS = {
    'lenta.ru': { requestsPerMinute: 30, burstLimit: 5, backoffMultiplier: 2.0, maxBackoffMinutes: 60 },
    'rbc.ru':   { requestsPerMinute: 20, burstLimit: 3, backoffMultiplier: 2.0, maxBackoffMinutes: 60 },
    'habr.com': { requestsPerMinute: 15, burstLimit: 3, backoffMultiplier: 1.8, maxBackoffMinutes: 45 },
    'default':  { requestsPerMinute: 10, burstLimit: 2, backoffMultiplier: 2.5, maxBackoffMinutes: 120 },
  };

  async canMakeRequest(domain: string): Promise<RateLimitResult> {
    const config = this.getConfigForDomain(domain);
    const state = await this.getState(domain) || this.getMemoryState(domain);

    // Проверяем backoff (после серии ошибок)
    if (state.backoffUntil && new Date() < state.backoffUntil) {
      const retryAfter = Math.ceil((state.backoffUntil.getTime() - Date.now()) / 1000);
      return { allowed: false, retryAfter, reason: 'Backoff period active', ... };
    }

    // Проверяем минутный лимит (sliding window)
    if (state.requestCount >= config.requestsPerMinute) {
      return { allowed: false, retryAfter: 60 - new Date().getSeconds(), ... };
    }

    // Проверяем burst (последние 10 секунд)
    const recentRequests = await this.getRecentRequestCount(domain, 10);
    if (recentRequests >= config.burstLimit) {
      return { allowed: false, retryAfter: 10, reason: 'Burst limit exceeded', ... };
    }

    return { allowed: true, ... };
  }

  async recordError(domain: string, error: string): Promise<void> {
    const state = await this.getState(domain) || this.getMemoryState(domain);
    state.consecutiveErrors++;

    // Exponential backoff при 503, 429, ECONNREFUSED, ETIMEDOUT...
    if (this.shouldApplyBackoff(error)) {
      const backoffMinutes = Math.min(
        Math.pow(config.backoffMultiplier, state.consecutiveErrors - 1),
        config.maxBackoffMinutes
      );
      state.backoffUntil = new Date(Date.now() + backoffMinutes * 60 * 1000);
    }

    await this.setState(domain, state); // Redis + memory cache
  }
}

export const rssRateLimiter = new RssRateLimiter();
```

---

## 📊 AlertManager — Система алертов

Работает **независимо** от цикла сбора. Проверяет условия каждые 30 секунд, собирая метрики системы.

```typescript
// server/infrastructure/monitoring/AlertManager.ts

export class AlertManager {
  private readonly CHECK_INTERVAL_MS = 30000; // каждые 30 секунд

  constructor() {
    this.initializeDefaultRules(); // 17 правил
    this.startMonitoring();        // setInterval
  }

  // Правила, связанные с RSS-сбором:
  private rssRules = [
    {
      id: 'rss-collection-stalled',
      severity: 'critical',
      cooldownMinutes: 15,
      condition: (metrics) => {
        const timeSince = Date.now() - metrics.lastCollectedAt.getTime();
        return timeSince > 30 * 60 * 1000; // > 30 минут без сбора
      },
    },
    {
      id: 'high-error-rate',
      severity: 'warning',
      cooldownMinutes: 10,
      condition: (metrics) => {
        if (metrics.totalSources === 0) return false;
        return (metrics.sourcesWithErrors / metrics.totalSources) > 0.5;
      },
    },
    {
      id: 'low-article-count',
      severity: 'warning',
      cooldownMinutes: 60,
      condition: (metrics) => metrics.articlesLast24h < 100,
    },
    {
      id: 'rate-limit-issues',
      severity: 'warning',
      cooldownMinutes: 15,
      condition: (metrics) => metrics.backedOffDomains > 2,
    },
  ];

  // Метрики собираются из живых компонентов через dynamic import
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const { collectNewsUseCase } = await import('../../application/news/CollectNewsUseCase');
    const { rssRateLimiter } = await import('../rss/RssRateLimiter');

    const rateLimitStats = await rssRateLimiter.getAllStats();

    return {
      lastCollectedAt: collectNewsUseCase.lastCycleAt ?? new Date(0),
      backedOffDomains: rateLimitStats.filter(s => s.isBackedOff).length,
      domainsWithErrors: rateLimitStats.filter(s => s.consecutiveErrors > 0).length,
      // + SSL, disk, Fail2Ban, cluster, memory...
    };
  }

  // Уведомления: WebSocket в админку + Webhook (Slack/Discord) для critical
  private async sendNotifications(alert: Alert, rule: AlertRule): Promise<void> {
    for (const channel of rule.channels) {
      if (channel.type === 'websocket') {
        await webSocketManager.broadcastToCluster({ type: 'alert_triggered', data: alert });
      }
      if (channel.type === 'webhook' && channel.config.url) {
        await fetch(channel.config.url, { method: 'POST', body: JSON.stringify({ alert }) });
      }
    }
  }
}

export const alertManager = new AlertManager();
```

**Важно для видео:** AlertManager не вызывается из `CollectNewsUseCase`. Он работает как отдельный процесс — опрашивает `collectNewsUseCase.lastCycleAt` и `rssRateLimiter.getAllStats()` через dynamic import каждые 30 секунд.

---

## 📅 ScheduleManagementService — Расписание

Управляет двумя cron-задачами. Расписание хранится в БД (таблица `source_config`) и может меняться без перезапуска.

```typescript
// server/application/news/ScheduleManagementService.ts

export class ScheduleManagementService {
  private fastCronExpression = '* * * * *';   // каждую минуту
  private slowCronExpression = '*/5 * * * *'; // каждые 5 минут

  async initialize(): Promise<void> {
    // Загружаем из БД — можно менять через админку без рестарта
    this.fastCronExpression = await sourceConfigRepository.get('fast_interval_cron');
    this.slowCronExpression = await sourceConfigRepository.get('slow_interval_cron');
  }

  startSchedule(fastHandler: () => void, slowHandler: () => void): void {
    this.fastCronJob = nodeCron.schedule(this.fastCronExpression, () => {
      if (!this.isRunning) fastHandler(); // Пропускаем если цикл уже идёт
    });

    this.slowCronJob = nodeCron.schedule(this.slowCronExpression, () => {
      if (!this.isRunning) slowHandler();
    });
  }

  // Метрики текущего цикла — используются в мониторинге
  startCycle(totalSources: number): void {
    this.isRunning = true;
    this.cycleMetrics.cycleStartedAt = new Date();
    this.cycleMetrics.totalSourcesInCycle = totalSources;
  }

  updateCycleProgress(sourceIndex: number, sourceName: string): void {
    this.cycleMetrics.currentSourceIndex = sourceIndex;
    this.cycleMetrics.currentSourceName = sourceName;
  }

  finishCycle(): void {
    this.cycleMetrics.lastCycleDurationMs = Date.now() - this.cycleMetrics.cycleStartedAt!.getTime();
    this.cycleMetrics.lastCycleAt = new Date();
    this.isRunning = false;
  }
}
```

---

## 🔗 Поток данных — итоговая схема

```
node-cron (fast: */1, slow: */5)
    │
    ▼
CollectNewsUseCase.execute(group)
    │
    ├─ loadBalancer.shouldHandleCollection()  ← Redis-блокировка в кластере
    │
    ├─ for each source (последовательно, 500ms задержка):
    │      │
    │      ├─ rssRateLimiter.canMakeRequest(domain)
    │      │
    │      ├─ parseSourceFeed(source)          ← strict → lenient fallback
    │      │      └─ parserStrict.parseURL()
    │      │         или parserLenient.parseURL()
    │      │
    │      ├─ articleService.persistArticles() ← ON CONFLICT DO NOTHING
    │      │
    │      ├─ articleService.processEntities() ← NER (graceful degradation)
    │      │
    │      └─ statsService.recordSuccessfulCollection()
    │
    ├─ rssCollectionDuration.observe()         ← Prometheus
    │
    └─ eventBus.emit('articles.collected')     ← WebSocket, Push, Clustering

AlertManager (независимо, каждые 30 сек)
    ├─ collectNewsUseCase.lastCycleAt          ← проверка staleness
    ├─ rssRateLimiter.getAllStats()            ← backed off domains
    └─ WebSocket / Webhook уведомления
```

---

*Все примеры соответствуют реальному production-коду проекта.*
