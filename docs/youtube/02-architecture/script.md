# Эпизод 2: "Архитектура и технологический стек"

> **Длительность:** 22-25 минут  
> **Цель:** Объяснить архитектурные принципы и технологические решения  
> **Аудитория:** Middle/Senior разработчики, архитекторы

---

## 🎯 Цели эпизода

### Основные задачи
- Объяснить принципы Domain-Driven Design в реальном проекте
- Показать структуру слоев и их взаимодействие
- Разобрать EventBus и слабую связанность компонентов
- Продемонстрировать выбор технологий и их обоснование
- Показать как DDD решает проблемы enterprise разработки

### Ключевые сообщения
- **DDD** — не просто папки, а архитектурный подход к сложности
- **Слои изоляции** — Domain не знает об Infrastructure
- **EventBus** — компоненты общаются через события, не напрямую
- **Технологический стек** — каждое решение обосновано и проверено

---

## 📝 Сценарий эпизода

### 🎬 Интро (2 минуты)

**[Заставка серии]**

**Ведущий на камеру:**
> Привет! Во втором эпизоде мы погрузимся в архитектуру NewsAggregator. В прошлом эпизоде вы видели что система умеет — сегодня узнаете как она устроена изнутри.

**[Показать схему архитектуры - 3 секунды]**

> Мы разберем:
> - Принципы Domain-Driven Design
> - Четыре слоя архитектуры и их роли
> - EventBus для слабой связанности
> - Технологический стек и обоснование выбора

**[Показать структуру папок проекта]**

> Это не академическая теория — это реальная архитектура production системы, которая обслуживает тысячи пользователей. Поехали!

---

### 🏗️ Блок 1: Проблемы сложности (4 минуты)

#### **Подблок 1.1: Почему нужна архитектура (2 минуты)**

**[Переход к экрану с кодом]**

**Ведущий (voice-over):**
> Начнем с главного вопроса — зачем вообще нужна сложная архитектура? Посмотрим на типичные проблемы.

**Показать "плохой" пример:**
```javascript
// Антипаттерн: все в одном файле
app.post('/api/news', async (req, res) => {
  // Валидация
  if (!req.body.url) return res.status(400).json({error: 'URL required'});
  
  // RSS парсинг
  const feed = await parser.parseURL(req.body.url);
  
  // Сохранение в БД
  const article = await db.query('INSERT INTO articles...');
  
  // Отправка уведомлений
  await sendWebSocketNotification(article);
  await sendPushNotification(article);
  
  // Кэш инвалидация
  await redis.del('news:cache:*');
  
  res.json(article);
});
```

**Ключевые проблемы:**
- "Смешаны разные уровни ответственности"
- "Невозможно тестировать изолированно"
- "Сложно масштабировать и поддерживать"
- "Изменение одного ломает другое"

#### **Подблок 1.2: Enterprise требования (2 минуты)**

**[Показать диаграмму сложности]**

**Ведущий:**
> В enterprise системах сложность растет экспоненциально:

**Показать метрики:**
- 50,000+ строк кода
- 20 таблиц в БД
- 15+ внешних интеграций
- 10+ разработчиков в команде
- 24/7 availability требования

**Ключевые моменты:**
- "Нужна изоляция компонентов"
- "Тестируемость критична"
- "Изменения должны быть безопасными"
- "Новые разработчики должны быстро разбираться"

---

### 🏛️ Блок 2: Domain-Driven Design (6 минут)

#### **Подблок 2.1: Основные принципы (2 минуты)**

**[Показать слайд с DDD принципами]**

**Ведущий:**
> Domain-Driven Design — это подход к проектированию сложных систем через моделирование предметной области.

**Ключевые концепции:**
1. **Ubiquitous Language** — единый язык команды
2. **Bounded Context** — границы ответственности
3. **Domain Model** — модель предметной области
4. **Layered Architecture** — слоистая архитектура

**Показать примеры из проекта:**
```typescript
// Ubiquitous Language в коде
class NewsArticle {
  publish(publishedAt: Date): void
  archive(): void
  cluster(similarArticles: NewsArticle[]): NewsCluster
}

// Bounded Context
namespace News {
  // Все что связано с новостями
}
namespace Weather {
  // Отдельный контекст для погоды
}
```

#### **Подблок 2.2: Слои архитектуры (4 минуты)**

**[Показать диаграмму слоев]**

**Ведущий:**
> Наша система построена по четырехслойной архитектуре:

**Показать структуру папок:**
```
server/
├── api/                    # API Layer
├── application/            # Application Layer  
├── domain/                 # Domain Layer
└── infrastructure/         # Infrastructure Layer
```

**1. Domain Layer (1 мин)**
```typescript
// server/domain/news/NewsArticle.ts
// NewsArticle — plain interface, не класс
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
  // ...
}

// Бизнес-логика — чистые функции, не методы класса
export function isStale(
  article: Pick<NewsArticle, 'publishedAt'>,
  days: number
): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return article.publishedAt < cutoff;
}
```

**Ключевые моменты:**
- "Interface + чистые функции — не класс с методами"
- "Никаких внешних зависимостей"
- "Легко тестировать"

**2. Application Layer (1 мин)**
```typescript
// server/application/news/CollectNewsUseCase.ts
export class CollectNewsUseCase {
  async execute(): Promise<void> {
    // Оркестрация бизнес-процессов
    const sources = await this.sourceRepository.getActive();
    
    for (const source of sources) {
      const articles = await this.rssParser.parse(source.rssUrl);
      await this.articleRepository.saveMany(articles);
    }
    
    // Событие для других компонентов
    this.eventBus.emit('articles.collected', { count: articles.length });
  }
}
```

**3. Infrastructure Layer (1 мин)**
```typescript
// server/infrastructure/rss/RssParser.ts
export class RssParser {
  async parse(url: string): Promise<NewsArticle[]> {
    // Работа с внешними системами
    const feed = await parser.parseURL(url);
    return feed.items.map(item => new NewsArticle(...));
  }
}
```

**4. API Layer (1 мин)**
```typescript
// server/api/news/index.ts
router.get('/news', async (req, res) => {
  // HTTP специфика
  const query = validateQuery(req.query);
  const result = await getNewsUseCase.execute(query);
  res.json(result);
});
```

---

### 🔄 Блок 3: EventBus и слабая связанность (5 минут)

#### **Подблок 3.1: Проблема сильной связанности (2 минуты)**

**[Показать "плохой" пример]**

**Ведущий:**
> Посмотрим на проблему сильной связанности:

```typescript
// Антипаттерн: прямые вызовы
class CollectNewsUseCase {
  constructor(
    private cacheService: CacheService,
    private webSocketManager: WebSocketManager,
    private pushService: PushService,
    private clusterService: ClusterService
  ) {}

  async execute(): Promise<void> {
    const articles = await this.collectArticles();
    
    // Прямые вызовы - сильная связанность!
    this.cacheService.invalidate(['news']);
    this.webSocketManager.broadcast('news_updated');
    this.pushService.sendToAll('New articles available');
    this.clusterService.updateClusters(articles);
  }
}
```

**Проблемы:**
- "CollectNewsUseCase знает о всех потребителях"
- "Сложно добавить новые обработчики"
- "Невозможно тестировать изолированно"

#### **Подблок 3.2: EventBus решение (3 минуты)**

**[Показать EventBus архитектуру]**

**Ведущий:**
> EventBus решает эту проблему через события:

```typescript
// server/infrastructure/events/EventBus.ts
export class EventBus {
  private subscribers = new Map<string, Function[]>();

  emit(eventName: string, data: any): void {
    const handlers = this.subscribers.get(eventName) || [];
    handlers.forEach(handler => handler(data));
  }

  subscribe(eventName: string, handler: Function): void {
    const handlers = this.subscribers.get(eventName) || [];
    handlers.push(handler);
    this.subscribers.set(eventName, handlers);
  }
}
```

**Использование:**
```typescript
// Издатель не знает о подписчиках
class CollectNewsUseCase {
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
}

// Подписчики регистрируются независимо
// server/application/news/subscribers.ts
// API: eventBus.on(), не subscribe()

// Кэш инвалидируется по cluster.updated, не articles.collected
export function initCacheSubscriber(): void {
  eventBus.on('cluster.updated', async () => {
    await queryCacheService.invalidateByTags(['news', 'clusters']);
  });
}

export function initWebSocketSubscriber(): void {
  eventBus.on('articles.collected', async (event) => {
    if (event.insertedCount > 0) {
      await webSocketManager.broadcastToCluster({
        type: 'news_updated',
        data: { newArticles: event.insertedCount },
        timestamp: new Date().toISOString()
      });
    }
  });
}
```

**Преимущества:**
- "Слабая связанность компонентов"
- "Легко добавлять новые обработчики"
- "Горизонтальное масштабирование"
- "Простое тестирование"

---

### 💻 Блок 4: Технологический стек (7 минут)

#### **Подблок 4.1: Frontend выбор (2.5 минуты)**

**[Показать схему Frontend стека]**

**Ведущий:**
> Разберем выбор технологий для фронтенда:

**React 18.3.1 + TypeScript 5.6.3:**
```typescript
// Современный React с хуками и Suspense
const NewsFeed: React.FC = () => {
  const { articles, loading } = useNews();
  
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <VirtualizedList items={articles} />
    </Suspense>
  );
};
```

**Почему React:**
- ✅ Зрелая экосистема
- ✅ Отличная TypeScript поддержка
- ✅ Concurrent Features для производительности
- ✅ Большое сообщество

**Vite 6.3.5 вместо Create React App:**
```javascript
// vite.config.js - быстрая сборка
export default defineConfig({
  plugins: [react(), vitePWA()],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@tanstack/react-virtual']
        }
      }
    }
  }
});
```

**Преимущества Vite:**
- ⚡ Мгновенный HMR
- 📦 Оптимизированная сборка
- 🔧 Простая конфигурация

**Zustand для состояния:**
```typescript
// Простое и типизированное состояние
const useNewsStore = create<NewsState>((set, get) => ({
  articles: [],
  filters: { region: 'russia', categories: [] },
  
  setFilters: (filters) => set({ filters }),
  addArticles: (articles) => set(state => ({
    articles: [...state.articles, ...articles]
  }))
}));
```

#### **Подблок 4.2: Backend выбор (2.5 минуты)**

**[Показать схему Backend стека]**

**Node.js 20 + Express.js 4.21.2:**
```typescript
// Типизированные роуты с валидацией
app.get('/api/news', 
  validateQuery(newsQuerySchema),
  async (req: TypedRequest<NewsQuery>, res) => {
    const result = await getNewsUseCase.execute(req.query);
    res.json(result);
  }
);
```

**Почему Node.js:**
- 🚀 Высокая производительность для I/O
- 📝 Единый язык с фронтендом
- 🔄 Отличная поддержка WebSocket
- 📦 Богатая экосистема npm

**PostgreSQL 17 + Drizzle ORM:**
```typescript
// Типизированные запросы
const articles = await db
  .select()
  .from(newsArticles)
  .where(
    and(
      eq(newsArticles.region, 'russia'),
      gte(newsArticles.publishedAt, yesterday)
    )
  )
  .orderBy(desc(newsArticles.publishedAt));
```

**Почему PostgreSQL:**
- 🔍 Полнотекстовый поиск (GIN индексы)
- 📊 JSONB для гибких данных
- 🔒 ACID транзакции
- 📈 Отличная производительность

**Redis 7 для кэширования:**
```typescript
// Тегированная инвалидация
await cacheService.set('news:russia:tech', articles, {
  ttl: 300,
  tags: ['news', 'russia', 'tech']
});

// Инвалидация по тегам
await cacheService.invalidateByTags(['news']);
```

#### **Подблок 4.3: AI и Infrastructure (2 минуты)**

**FastAPI для NER сервиса:**
```python
# Отдельный микросервис на Python
@app.post("/extract")
async def extract_entities(request: TextRequest):
    doc = nlp(request.text)
    entities = {
        "PER": [ent.text for ent in doc.ents if ent.label_ == "PER"],
        "ORG": [ent.text for ent in doc.ents if ent.label_ == "ORG"],
        "LOC": [ent.text for ent in doc.ents if ent.label_ == "LOC"]
    }
    return entities
```

**Почему отдельный сервис:**
- 🐍 Python лучше для ML
- 🔄 Независимое масштабирование
- 🛡️ Изоляция ошибок
- 🚀 Graceful degradation

**Docker + Nginx + Cloudflare:**
```yaml
# docker-compose.yml
services:
  app:
    build: .
    environment:
      - NODE_ENV=production
  
  postgres:
    image: postgres:17
    
  redis:
    image: redis:7
    
  ner-service:
    build: ./ner-service
```

---

### 🔍 Блок 5: Практический разбор кода (4 минуты)

#### **Подблок 5.1: Пример Use Case (2 минуты)**

**[Открыть VS Code с проектом]**

**Ведущий:**
> Посмотрим как все это работает на практике:

**Показать файл:** `server/application/news/CollectNewsUseCase.ts`

```typescript
// Singleton — зависимости создаются внутри, не через конструктор
class CollectNewsUseCase {
  private readonly rssService = new RssCollectionService();
  private readonly articleService = new ArticleManagementService();
  private readonly scheduleService = new ScheduleManagementService();

  async execute(group: 'fast' | 'slow' | 'all' = 'all'): Promise<void> {
    // Защита от параллельного запуска
    if (this.scheduleService.isCycleRunning()) return;

    const sources = await this.getSourcesToProcess(group);
    this.scheduleService.startCycle(sources.length);

    try {
      // Последовательная обработка с задержкой 500ms
      for (const [index, source] of sources.entries()) {
        this.scheduleService.updateCycleProgress(index + 1, source.name);
        await this.processSource(source);
        await this.delay(500);
      }

      // Событие для WebSocket и кластеризации
      eventBus.emit('articles.collected', { ... });

    } finally {
      this.scheduleService.finishCycle();
    }
  }
}

export const collectNewsUseCase = new CollectNewsUseCase();
```

**Ключевые моменты:**
- "Singleton, не DI через конструктор"
- "Последовательная обработка — защита источников от перегрузки"
- "Событие в конце для уведомления других компонентов"

#### **Подблок 5.2: Event Subscribers (2 минуты)**

**Показать файл:** `server/application/news/subscribers.ts`

```typescript
// Три отдельные функции инициализации — без параметров
// Зависимости берутся из singleton-импортов

// Кэш инвалидируется по cluster.updated (после кластеризации)
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
        data: { newArticles: event.insertedCount },
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

**Ключевые моменты:**
- "Три отдельные функции, не одна setupNewsSubscribers()"
- "API: eventBus.on(), не subscribe()"
- "Кэш — по cluster.updated, WebSocket/Push — по articles.collected"

---

### 🎓 Заключение (2 минуты)

**[Вернуться на камеру]**

**Ведущий:**
> Подведем итоги архитектурных решений:

**[Показать итоговую схему]**

**Ключевые принципы:**
1. **DDD слои** — четкое разделение ответственности
2. **EventBus** — слабая связанность через события
3. **Технологический стек** — каждое решение обосновано
4. **Тестируемость** — изолированные компоненты

**Преимущества архитектуры:**
- ✅ Легко добавлять новые функции
- ✅ Простое тестирование компонентов
- ✅ Горизонтальное масштабирование
- ✅ Быстрое onboarding новых разработчиков

> В следующем эпизоде мы погрузимся в детали RSS сбора — увидим как система каждую минуту собирает новости из 15+ источников, обрабатывает ошибки и масштабируется.

**[Показать превью следующего эпизода]**

> Подписывайтесь, ставьте лайки, и увидимся в следующем эпизоде!

**[Заставка с подпиской]**

---

## 🎥 Технические требования

### Подготовка к записи
- [ ] Открыть VS Code с проектом
- [ ] Подготовить файлы для демонстрации
- [ ] Настроить подсветку синтаксиса
- [ ] Проверить что все импорты корректны
- [ ] Подготовить диаграммы архитектуры

### Файлы для показа
```
server/
├── domain/news/
│   ├── NewsArticle.ts
│   ├── NewsCluster.ts
│   └── events/
├── application/news/
│   ├── CollectNewsUseCase.ts
│   ├── ClusterNewsUseCase.ts
│   └── subscribers.ts
├── infrastructure/
│   ├── rss/RssParser.ts
│   ├── events/EventBus.ts
│   └── monitoring/AlertManager.ts
└── api/news/
    └── index.ts
```

### Диаграммы для показа
1. **DDD Layers** — четыре слоя и их взаимодействие
2. **EventBus Flow** — как события проходят через систему
3. **Technology Stack** — выбранные технологии
4. **Dependency Graph** — кто от кого зависит
5. **Use Case Flow** — от HTTP запроса до ответа

---

## 📊 Ключевые метрики для демонстрации

### Архитектурные метрики
- **4 слоя** архитектуры
- **12 событий** в EventBus
- **50+ Use Cases** в Application слое
- **0 циклических зависимостей**

### Технологические решения
- **React 18** — Concurrent Features
- **TypeScript 5.6** — строгая типизация
- **PostgreSQL 17** — ACID + полнотекстовый поиск
- **Redis 7** — кэширование + pub/sub

---

## 🎯 Целевые реакции зрителей

### После просмотра зрители должны:
- Понимать принципы DDD и их применение
- Видеть преимущества слоистой архитектуры
- Понимать как EventBus решает проблемы связанности
- Знать обоснование выбора технологий

### Комментарии которых ожидаем:
- "Теперь понятно зачем нужен DDD!"
- "EventBus — гениальное решение для масштабирования"
- "Хочу увидеть как тестируется такая архитектура"
- "Когда эпизод про RSS сбор?"

---

*Этот эпизод заложит архитектурный фундамент для понимания всех последующих эпизодов серии.*