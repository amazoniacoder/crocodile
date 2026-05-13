# Примеры кода для Эпизода 2: "Архитектура и технологический стек"

> **Цель:** Подготовленные фрагменты кода для демонстрации архитектурных принципов

---

## 🚫 Антипаттерн: Все в одном файле

### Плохой пример (для контраста)
```javascript
// ❌ Антипаттерн: монолитный контроллер
app.post('/api/news/collect', async (req, res) => {
  try {
    // Валидация прямо в контроллере
    if (!req.headers.authorization) {
      return res.status(401).json({error: 'Unauthorized'});
    }
    
    // Бизнес-логика смешана с HTTP
    const sources = await db.query('SELECT * FROM news_sources WHERE is_active = true');
    
    for (const source of sources) {
      // RSS парсинг в контроллере
      const response = await fetch(source.rss_url);
      const xml = await response.text();
      const feed = await parser.parseString(xml);
      
      for (const item of feed.items) {
        // Прямая работа с БД
        await db.query(`
          INSERT INTO news_articles (title, url, published_at, source_id)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (url) DO NOTHING
        `, [item.title, item.link, item.pubDate, source.id]);
      }
    }
    
    // Уведомления прямо здесь
    io.emit('news_updated', {message: 'New articles collected'});
    
    // Кэш инвалидация
    await redis.del('news:*');
    
    res.json({success: true});
    
  } catch (error) {
    console.error(error);
    res.status(500).json({error: 'Internal server error'});
  }
});
```

### Проблемы этого подхода
```typescript
// Проблемы монолитного подхода:
// ❌ Смешаны разные уровни ответственности
// ❌ Невозможно тестировать изолированно  
// ❌ Сложно масштабировать
// ❌ Изменение одного ломает другое
// ❌ Дублирование кода
// ❌ Нарушение принципа единственной ответственности
```

---

## ✅ Domain Layer — Чистая бизнес-логика

### NewsArticle — interface, не класс
```typescript
// server/domain/news/NewsArticle.ts
export const NEWS_REGIONS = ['russia', 'world'] as const;
export const NEWS_CATEGORIES = ['economy', 'tech', 'politics', 'society', 'other'] as const;

export type NewsRegion = typeof NEWS_REGIONS[number];
export type NewsCategory = typeof NEWS_CATEGORIES[number];

// NewsArticle — plain interface без методов
export interface NewsArticle {
  id: number;
  sourceId: number | null;
  title: string;
  url: string;
  publishedAt: Date;
  region: NewsRegion;
  category: NewsCategory;
  clusterId: number | null;
  isArchived: boolean;
  sourceType?: 'rss' | 'telegram' | 'youtube';
  // ...
}

/** Статья для вставки в БД — без id и служебных полей */
export type NewArticleInput = Omit<
  NewsArticle,
  'id' | 'clusterId' | 'isArchived' | 'createdAt' | 'fetchedAt' | 'likesCount' | 'dislikesCount'
>;

// Бизнес-логика — чистые функции, не методы класса
export function isStale(
  article: Pick<NewsArticle, 'publishedAt'>,
  days: number
): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return article.publishedAt < cutoff;
}

export function isValidRegion(value: string): value is NewsRegion {
  return (NEWS_REGIONS as readonly string[]).includes(value);
}
```

**Ключевые моменты для видео:**
- Domain Layer — interface + чистые функции, не ООП-класс
- Никаких внешних зависимостей, никаких импортов фреймворков
- `isStale()` вместо `canBeArchived()` — функция принимает данные, не хранит состояние

---

## ✅ Application Layer — Use Cases и оркестрация

### CollectNewsUseCase
```typescript
// server/application/news/CollectNewsUseCase.ts
// Singleton — зависимости создаются внутри, не через DI-контейнер
class CollectNewsUseCase {
  private readonly rssService    = new RssCollectionService();
  private readonly articleService = new ArticleManagementService();
  private readonly scheduleService = new ScheduleManagementService();
  private readonly statsService   = new StatisticsCollectionService();

  async execute(group: 'fast' | 'slow' | 'all' = 'all'): Promise<void> {
    if (this.scheduleService.isCycleRunning()) return;

    const sources = await this.getSourcesToProcess(group);
    this.scheduleService.startCycle(sources.length);

    try {
      // Последовательная обработка с задержкой 500ms
      for (const [index, source] of sources.entries()) {
        this.scheduleService.updateCycleProgress(index + 1, source.name);
        try {
          await this.processSource(source);
        } catch (error) {
          console.error(`Failed to process ${source.name}:`, error);
        }
        await this.delay(500);
      }

      // Prometheus метрики
      rssCollectionDuration.observe((Date.now() - startTime) / 1000);

      // Событие для WebSocket и кластеризации
      eventBus.emit('articles.collected', { ... });

    } finally {
      this.scheduleService.finishCycle();
    }
  }
}

export const collectNewsUseCase = new CollectNewsUseCase();
```

### Event Subscribers
```typescript
// server/application/news/subscribers.ts
// Три отдельные функции без параметров — зависимости берутся из singleton-импортов

// Кэш инвалидируется по cluster.updated (после кластеризации), не по articles.collected
export function initCacheSubscriber(): void {
  eventBus.on('cluster.updated', async () => {
    await queryCacheService.invalidateByTags(['news', 'clusters']);
  });
}

// WebSocket + Web Push — по articles.collected
export function initWebSocketSubscriber(): void {
  eventBus.on('articles.collected', async (event) => {
    if (event.insertedCount > 0) {
      await webSocketManager.broadcastToCluster({
        type: 'news_updated',
        data: { newArticles: event.insertedCount, sourceName: event.sourceName },
        timestamp: new Date().toISOString()
      });
    }

    if (event.insertedCount >= PUSH_THRESHOLD) {
      webPushService.broadcast({
        title: 'Новые статьи',
        body: `Появилось ${event.insertedCount} новых материалов`,
        url: '/'
      }).catch(() => {});
    }
  });
}
```

---

## ✅ Infrastructure Layer — Внешние системы

### parseSourceFeed — функция, не класс
```typescript
// server/infrastructure/rss/RssParser.ts
// Два инстанса парсера на уровне модуля
const parserStrict  = new Parser({ timeout: 5000, xml2js: { strict: true } });
const parserLenient = new Parser({ timeout: 5000, xml2js: { strict: false } });

export async function parseSourceFeed(source: NewsSource): Promise<ParsedFeed> {
  let feed;
  try {
    feed = await parserStrict.parseURL(source.rssUrl);
  } catch (err) {
    if (isXmlError(err)) {
      feed = await parserLenient.parseURL(source.rssUrl);
    } else {
      throw err;
    }
  }

  if (!feed.items?.length) return { articles: [] };

  const articles: NewArticleInput[] = [];
  for (const item of feed.items.slice(0, 50)) {
    const url   = item.link?.trim();
    const title = item.title?.trim();
    if (!url || !title) continue;
    // Специальная логика для rbc.ru, telegram, youtube...
    articles.push({ sourceId: source.id, title, url, ... });
  }

  return { articles };
}
```

### EventBus Implementation
```typescript
// server/infrastructure/events/EventBus.ts
// Обёртка над Node.js EventEmitter со строгой типизацией

interface EventMap {
  'articles.collected': ArticlesCollected;
  'cluster.updated':    ClusterUpdated;
  'source.updated':     { sourceId: number; changes: any; type: string; occurredAt: Date };
  'reaction.updated':   { articleId: number; type: string; occurredAt: Date };
}

class EventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(20);
  }

  // emit / on / off / once — не subscribe/unsubscribe!
  emit<K extends keyof EventMap>(type: K, event: EventMap[K]): void {
    this.emitter.emit(type, event);
  }

  on<K extends keyof EventMap>(type: K, handler: EventHandler<EventMap[K]>): void {
    this.emitter.on(type, (event) => {
      Promise.resolve(handler(event)).catch(err =>
        console.error(`[EventBus] Unhandled error in handler for "${type}":`, err)
      );
    });
  }

  off<K extends keyof EventMap>(type: K, handler: EventHandler<EventMap[K]>): void {
    this.emitter.off(type, handler);
  }
}

export const eventBus = new EventBus();
```

**Ключевые моменты для видео:**
- API: `on()` / `off()` / `emit()` — не `subscribe()` / `unsubscribe()`
- Строгая типизация через EventMap — только 4 события
- Ошибка в обработчике не пробрасывается наружу
- Комментарий: при переходе на PM2 cluster — заменить тело класса на Redis pub/sub

---

## ✅ API Layer — HTTP интерфейс

### News Controller
```typescript
// server/api/news/index.ts
export const createNewsRouter = (
  getNewsUseCase: GetNewsUseCase,
  collectNewsUseCase: CollectNewsUseCase
) => {
  const router = express.Router();

  // GET /api/news - получение ленты новостей
  router.get('/', 
    validateQuery(newsQuerySchema),
    async (req: TypedRequest<NewsQuery>, res: TypedResponse<NewsResponse>) => {
      try {
        const result = await getNewsUseCase.execute(req.query);
        
        // Кэширование на клиенте
        res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        
        res.json({
          success: true,
          data: result.articles,
          pagination: result.pagination,
          filters: result.appliedFilters
        });
        
      } catch (error) {
        logger.error('Get news failed', { query: req.query, error });
        
        res.status(500).json({
          success: false,
          error: 'Failed to fetch news'
        });
      }
    }
  );

  // POST /api/admin/news/collect - ручной запуск сбора
  router.post('/collect',
    authenticateAdmin,
    validateBody(collectRequestSchema),
    async (req: TypedRequest<CollectRequest>, res: TypedResponse<CollectResponse>) => {
      try {
        const result = await collectNewsUseCase.execute(req.body.schedule);
        
        res.json({
          success: true,
          data: {
            insertedCount: result.insertedCount,
            totalCount: result.totalCount,
            duration: result.duration,
            sources: result.sourceResults
          }
        });
        
      } catch (error) {
        logger.error('Manual collection failed', { body: req.body, error });
        
        res.status(500).json({
          success: false,
          error: 'Collection failed'
        });
      }
    }
  );

  return router;
};

// Типизированные интерфейсы
interface TypedRequest<T> extends Request {
  query: T;
  body: T;
}

interface TypedResponse<T> extends Response {
  json(body: T): this;
}
```

---

## 🔧 Паттерн зависимостей — Singleton

В проекте нет DI-контейнера. Зависимости создаются через `new` внутри классов и экспортируются как singleton.

### Реальный паттерн
```typescript
// Каждый сервис — singleton-экспорт
export const rssRateLimiter       = new RssRateLimiter();
export const rssCollectionService = new RssCollectionService();
export const alertManager         = new AlertManager();
export const eventBus             = new EventBus();

// CollectNewsUseCase создаёт зависимости внутри
class CollectNewsUseCase {
  private readonly rssService = new RssCollectionService();
  // ...
}
export const collectNewsUseCase = new CollectNewsUseCase();
```

**Почему так, а не DI-контейнер:**
- Простота — нет boilerplate
- Достаточно для однопроцессного Node.js-сервера
- Тесты мокают зависимости на уровне модуля

---

## 📊 Типы и интерфейсы

### Domain Types
```typescript
// shared/types/domain.ts
export interface NewsQuery {
  region?: 'russia' | 'world';
  categories?: string[];
  city?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface CollectionResult {
  insertedCount: number;
  totalCount: number;
  duration: number;
  sourceResults: SourceCollectionResult[];
}

export interface ArticlesCollectedEvent {
  insertedCount: number;
  totalCount: number;
  schedule: 'fast' | 'slow';
  duration: number;
  timestamp: Date;
}
```

---

*Эти примеры кода демонстрируют реальную реализацию DDD принципов и архитектурных паттернов в production системе.*