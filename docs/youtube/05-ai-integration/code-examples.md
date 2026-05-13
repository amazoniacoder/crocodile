# Примеры кода для Эпизода 5: "AI интеграция: NER и кластеризация"

> Все примеры взяты из реального кода проекта

---

## 🧠 NerService — извлечение сущностей

```typescript
// server/infrastructure/ner/NerService.ts

export interface ArticleEntities {
  PER: string[];  // персоны
  ORG: string[];  // организации
  LOC: string[];  // локации
}

class NerService {
  private readonly nerUrl = process.env.NER_SERVICE_URL ?? 'http://ner-service:8001';
  private readonly batchSize = parseInt(process.env.NER_BATCH_SIZE ?? '10');
  private readonly timeoutMs = parseInt(process.env.NER_TIMEOUT_MS ?? '5000');

  // forOptionalService: failureThreshold=10, timeout=120s, successThreshold=1
  private readonly circuitBreaker = CircuitBreakerFactory.forOptionalService('NER');

  // Батчевая обработка с Circuit Breaker
  private async extractBatch(titles: string[]): Promise<(ArticleEntities | null)[]> {
    return this.circuitBreaker.execute(
      async () => {
        const res = await fetch(`${this.nerUrl}/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: titles }),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!res.ok) throw new Error(`NER responded with ${res.status}`);
        return await res.json() as ArticleEntities[];
      },
      // Fallback — немедленно при OPEN Circuit Breaker
      async () => {
        console.warn('🔄 NER unavailable, using fallback (empty entities)');
        return titles.map(() => null);
      }
    );
  }

  // Нормализация токенов через pymorphy2
  // "встретился", "встречи", "встреча" → "встреча", "встреча", "встреча"
  async normalizeTokens(tokens: string[]): Promise<string[]> {
    if (!tokens.length) return tokens;
    try {
      const res = await fetch(`${this.nerUrl}/normalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens }),
        signal: AbortSignal.timeout(2000), // короткий таймаут
      });
      if (!res.ok) return tokens; // fallback: исходные токены
      const data = await res.json() as { tokens: string[] };
      return data.tokens;
    } catch {
      return tokens; // graceful degradation
    }
  }

  // Обработка массива статей батчами
  async extractEntitiesForArticles(
    articles: Array<{ id: number; title: string }>
  ): Promise<Map<number, ArticleEntities | null>> {
    const result = new Map<number, ArticleEntities | null>();

    for (let i = 0; i < articles.length; i += this.batchSize) {
      const batch = articles.slice(i, i + this.batchSize);
      const entities = await this.extractBatch(batch.map(a => a.title));
      batch.forEach((article, idx) => {
        result.set(article.id, entities[idx]);
      });
    }
    return result;
  }

  isAvailable(): boolean {
    return this.circuitBreaker.isAvailable(); // state !== 'OPEN'
  }
}

export const nerService = new NerService();
```

---

## ⚡ CircuitBreaker — три состояния

```typescript
// server/infrastructure/patterns/CircuitBreaker.ts

export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private lastFailTime = 0;

  // failureThreshold=10, timeout=120000, successThreshold=1 (для NER)
  constructor(private readonly options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime >= this.options.timeout) {
        this.state = 'HALF_OPEN'; // пробный запрос
      } else {
        // Немедленный fallback — не ждём таймаут
        if (fallback) return await fallback();
        throw new CircuitBreakerError('Circuit breaker is OPEN', 'OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback && this.state !== 'CLOSED') return await fallback();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      // successThreshold успехов → CLOSED
      if (++this.successes >= this.options.successThreshold) {
        this.state = 'CLOSED';
        this.failures = 0;
      }
    }
  }

  private onFailure(): void {
    this.lastFailTime = Date.now();
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN'; // любая ошибка в HALF_OPEN → обратно в OPEN
    } else if (++this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}

// Фабрика с предустановленными конфигурациями
export class CircuitBreakerFactory {
  static forOptionalService(name: string) {
    return new CircuitBreaker({
      failureThreshold: 10,  // мягко — 10 ошибок
      timeout: 120000,       // 2 минуты в OPEN
      successThreshold: 1,   // 1 успех для восстановления
      monitoringPeriod: 300000,
    });
  }

  static forCriticalService(name: string) {
    return new CircuitBreaker({
      failureThreshold: 3,   // жёстко — 3 ошибки
      timeout: 60000,
      successThreshold: 3,
      monitoringPeriod: 30000,
    });
  }
}
```

---

## 🔄 GracefulNerService — четыре уровня деградации

```typescript
// server/infrastructure/ner/GracefulNerService.ts

export class GracefulNerService {
  private nerAvailable = true;
  private lastNerCheck = 0;
  private readonly checkInterval = 60000; // проверка раз в минуту

  constructor(private readonly options = {
    enableFallback: true,
    fallbackStrategy: 'simple' as 'empty' | 'simple' | 'keyword',
    maxRetries: 2,
    retryDelay: 1000,
  }) {}

  async processEntities(articles: Array<{ id: number; title: string }>) {
    await this.checkNerAvailability(); // не чаще раза в минуту

    if (this.nerAvailable) {
      try {
        // Уровень 1: основной NER с retry
        return await this.processWithRetries(articles);
      } catch {
        this.nerAvailable = false;
      }
    }

    // Уровень 2-4: fallback стратегии
    return this.processFallback(articles);
  }

  // Уровень 2: simple — regex-паттерны для русского языка
  private simpleFallback(title: string): ArticleEntities {
    const entities = { PER: [], ORG: [], LOC: [] };

    // Персоны: "Имя Фамилия"
    const persons = title.match(/([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+)/g) ?? [];
    entities.PER = [...new Set(persons)].slice(0, 3);

    // Организации: "ООО/АО/ПАО Название"
    const orgs = title.match(/(ООО|АО|ПАО|ЗАО)\s+[«"]?([А-ЯЁа-яё\s\-]+)[«"]?/g) ?? [];
    entities.ORG = [...new Set(orgs)].slice(0, 3);

    // Локации: "г. Москва", "Петербург"
    const locs = title.match(/(г\.\s*[А-ЯЁ][а-яё\-]+)/g) ?? [];
    entities.LOC = [...new Set(locs)].slice(0, 3);

    return entities;
  }

  // Уровень 3: keyword — словарь известных сущностей
  private keywordFallback(title: string): ArticleEntities {
    const knownPersons = ['Путин', 'Байден', 'Трамп', 'Зеленский', 'Медведев', 'Лавров'];
    const knownOrgs = ['Газпром', 'Роснефть', 'Сбербанк', 'Яндекс', 'ФСБ', 'МВД', 'ЦБ'];
    const knownLocations = ['Москва', 'Петербург', 'Россия', 'США', 'Украина', 'Китай'];

    const titleLower = title.toLowerCase();
    return {
      PER: knownPersons.filter(p => titleLower.includes(p.toLowerCase())),
      ORG: knownOrgs.filter(o => titleLower.includes(o.toLowerCase())),
      LOC: knownLocations.filter(l => titleLower.includes(l.toLowerCase())),
    };
  }

  // Уровень 4: empty — пустые массивы
  private emptyFallback(): ArticleEntities {
    return { PER: [], ORG: [], LOC: [] };
  }
}

export const gracefulNerService = new GracefulNerService({
  enableFallback: true,
  fallbackStrategy: 'simple',
  maxRetries: 2,
  retryDelay: 1000,
});
```

---

## 🔗 NewsCluster — Domain Layer

```typescript
// server/domain/news/NewsCluster.ts

const STOP_WORDS = new Set([
  'заявил', 'заявила', 'сообщил', 'рассказал', 'назвал', 'стало',
  'после', 'будет', 'этого', 'также', 'более', 'своих',
  'said', 'says', 'over', 'after', 'first', 'last', 'year',
  // ...
]);

const MIN_WORD_LENGTH = 4;
export const MIN_COMMON_WORDS = 2; // порог похожести

// Базовая токенизация без морфологии
export function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\wа-яёa-z\s]/gi, '')
      .split(/\s+/)
      .filter(w => w.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(w))
  );
}

// С морфологической нормализацией
// normalize = nerService.normalizeTokens или identity при деградации
export async function tokenizeNormalized(
  title: string,
  normalize: (tokens: string[]) => Promise<string[]>
): Promise<Set<string>> {
  const raw = Array.from(tokenize(title));
  const normalized = await normalize(raw);
  return new Set(normalized);
}
```

---

## 🔗 ClusterNewsUseCase — алгоритм

```typescript
// server/application/news/ClusterNewsUseCase.ts

const CLUSTER_WINDOW_HOURS = 2;

class ClusterNewsUseCase {
  initialize(): void {
    // Запускается после каждого цикла сбора
    eventBus.on('articles.collected', async () => {
      await this.execute();
    });
  }

  async execute() {
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - CLUSTER_WINDOW_HOURS);

    // Только некластеризованные статьи за последние 2 часа
    const unclustered = await newsArticleRepository.findUnclustered(windowStart);
    if (unclustered.length < 2) {
      eventBus.emit('cluster.updated', { ... });
      return { clustersCreated: 0, singles: unclustered.length };
    }

    const groups = await this.groupBySimilarity(unclustered);
    let clustersCreated = 0;

    for (const group of groups) {
      if (group.length < 2) continue;
      const cluster = await newsClusterRepository.insert({
        title: group[0].title,
        articleCount: group.length,
        region: group[0].region,
        category: group[0].category,
      });
      await newsArticleRepository.assignCluster(group.map(a => a.id), cluster.id);
      clustersCreated++;
    }

    eventBus.emit('cluster.updated', { clustersCreated, ... });
    return { clustersCreated, singles: groups.filter(g => g.length === 1).length };
  }

  private async groupBySimilarity(articles: NewsArticle[]) {
    // Шаг 1: разбиваем по region:category — O(n)
    const buckets = new Map<string, NewsArticle[]>();
    for (const a of articles) {
      const key = `${a.region}:${a.category}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(a);
    }

    // Шаг 2: кластеризуем каждый bucket
    const allGroups: NewsArticle[][] = [];
    for (const bucket of buckets.values()) {
      allGroups.push(...await this.clusterBucket(bucket));
    }
    return allGroups;
  }

  private async clusterBucket(articles: NewsArticle[]) {
    // Graceful degradation: NER или identity
    const normalize = nerService.isAvailable()
      ? (tokens: string[]) => nerService.normalizeTokens(tokens)
      : (tokens: string[]) => Promise.resolve(tokens);

    // O(n) запросов к NER — нормализуем все заголовки заранее
    const normalizedSets = await Promise.all(
      articles.map(a => tokenizeNormalized(a.title, normalize))
    );

    const assigned = new Set<number>();
    const groups: NewsArticle[][] = [];

    // O(n²) сравнение внутри bucket
    for (let i = 0; i < articles.length; i++) {
      if (assigned.has(i)) continue;
      const group = [articles[i]];
      assigned.add(i);

      for (let j = i + 1; j < articles.length; j++) {
        if (assigned.has(j)) continue;
        let common = 0;
        for (const word of normalizedSets[i]) {
          if (normalizedSets[j].has(word)) common++;
        }
        if (common >= MIN_COMMON_WORDS) {
          group.push(articles[j]);
          assigned.add(j);
        }
      }
      groups.push(group);
    }
    return groups;
  }
}

export const clusterNewsUseCase = new ClusterNewsUseCase();
```

---

## 🔍 EntityClusterService — поиск похожих

```typescript
// server/application/news/EntityClusterService.ts

const ENTITY_WINDOW_HOURS = 48;

export async function findSimilarArticles(article: ArticleWithEntities) {
  let similarArticles: NewsArticle[] = [];

  // Шаг 1: по FIRST-сущности (первая сущность из заголовка)
  const firstTerm = article.entities?.FIRST?.[0];
  if (firstTerm) {
    const since = new Date(Date.now() - ENTITY_WINDOW_HOURS * 3_600_000);
    const byFirst = await newsArticleRepository.findByEntities({
      terms: [firstTerm],
      minMatches: 1,
      since,
      excludeId: article.id,
      limit: 100,
    });
    const filtered = filterDuplicatesFromSameSource(byFirst, article.sourceId);
    if (filtered.length > 0) similarArticles = filtered.slice(0, 6);
  }

  // Шаг 2: fallback по cluster_id
  if (similarArticles.length === 0 && article.clusterId) {
    const byCluster = await newsArticleRepository.findByClusterIdLimited(
      article.clusterId, 100, article.id
    );
    const filtered = filterDuplicatesFromSameSource(byCluster, article.sourceId);
    if (filtered.length > 0) similarArticles = filtered.slice(0, 6);
  }

  // Шаг 3: "Другие новости" из той же категории (всегда)
  const byCategory = await newsArticleRepository.findRecentByCategory(
    article.category, article.region, 3, article.id
  );

  return {
    similarArticles,
    otherArticles: filterDuplicatesFromSameSource(byCategory, article.sourceId),
  };
}

function filterDuplicatesFromSameSource(articles: NewsArticle[], excludeSourceId: number) {
  const seen = new Set<string>();
  return articles.filter(article => {
    if (article.sourceId === excludeSourceId) return false;
    const normalized = article.title.toLowerCase().replace(/[^а-яёa-z0-9\s]/g, '').trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
```

---

## 📊 NerBatchProcessor — адаптивные батчи

```typescript
// server/infrastructure/ner/NerBatchProcessor.ts

const MIN_BATCH_SIZE = 5;
const MAX_BATCH_SIZE = 50;
const INITIAL_BATCH_SIZE = 10;

class NerBatchProcessor {
  private currentBatchSize = INITIAL_BATCH_SIZE;
  private metrics: BatchMetrics[] = []; // последние 100 батчей

  private calculateOptimalBatchSize(): number {
    if (this.metrics.length < 3) return this.currentBatchSize;

    const recent = this.metrics.slice(-10);
    const avgTimePerArticle = recent.reduce((s, m) => s + m.processingTimeMs / m.batchSize, 0) / recent.length;
    const avgSuccessRate = recent.reduce((s, m) => s + m.successRate, 0) / recent.length;

    let newSize = this.currentBatchSize;

    // Быстро и успешно → увеличиваем
    if (avgTimePerArticle < 200 && avgSuccessRate > 0.9) {
      newSize = Math.min(newSize + 5, MAX_BATCH_SIZE);
    }
    // Медленно или ошибки → уменьшаем
    else if (avgTimePerArticle > 500 || avgSuccessRate < 0.7) {
      newSize = Math.max(newSize - 3, MIN_BATCH_SIZE);
    }

    this.currentBatchSize = newSize;
    return newSize;
  }
}

export const nerBatchProcessor = new NerBatchProcessor();
```

---

*Все примеры соответствуют реальному production-коду проекта.*
