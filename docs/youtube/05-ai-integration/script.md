# Эпизод 5: "AI интеграция: NER и кластеризация"

> **Длительность:** 25-30 минут
> **Цель:** Показать как работает NER-сервис, кластеризация и Circuit Breaker
> **Аудитория:** Backend разработчики, ML-инженеры, архитекторы

---

## 🎯 Цели эпизода

- Показать архитектуру NER-микросервиса на FastAPI + Natasha
- Разобрать алгоритм токенной кластеризации с морфологией
- Объяснить Circuit Breaker паттерн для некритичных сервисов
- Показать Graceful Degradation — три fallback стратегии
- Разобрать Entity-Driven поиск похожих статей

---

## 📝 Сценарий эпизода

### 🎬 Интро (2 минуты)

**[Показать UI — карточка с "Похожие новости"]**

**Ведущий:**
> Привет! В пятом эпизоде разберём AI-интеграцию. Вот карточка новости — система автоматически нашла похожие материалы из разных источников. Как это работает? Никакой нейросети — только NER, морфология и умная кластеризация.

**[Показать схему потока]**

> Сегодня разберём:
> - NER-сервис на FastAPI + Natasha — извлечение сущностей
> - pymorphy2 — морфологическая нормализация
> - Алгоритм кластеризации — токены + MIN_COMMON_WORDS
> - Circuit Breaker — система работает даже без NER
> - Три fallback стратегии — empty, simple, keyword

---

### 🧠 Блок 1: NER-сервис (5 минут)

#### Подблок 1.1: Что такое NER

**[Показать слайд с примером]**

**Ведущий:**
> NER — Named Entity Recognition. Из заголовка «Путин встретился с Байденом в Женеве» извлекаем:

```
PER: ["Путин", "Байден"]
LOC: ["Женева"]
ORG: []
```

> Это позволяет группировать статьи по смыслу, а не по совпадению слов.

#### Подблок 1.2: Архитектура NER-сервиса

**[Показать server/infrastructure/ner/NerService.ts]**

```typescript
class NerService {
  private readonly nerUrl = process.env.NER_SERVICE_URL ?? 'http://ner-service:8001';
  private readonly batchSize = parseInt(process.env.NER_BATCH_SIZE ?? '10');
  private readonly timeoutMs = parseInt(process.env.NER_TIMEOUT_MS ?? '5000');

  // Circuit Breaker для некритичного сервиса
  private readonly circuitBreaker = CircuitBreakerFactory.forOptionalService('NER');
  // forOptionalService: failureThreshold=10, timeout=120s, successThreshold=1
}
```

**Ключевые моменты:**
- Отдельный Python-микросервис на порту 8001
- Батчевая обработка — 10 заголовков за запрос
- Таймаут 5 секунд — не ждём медленный NER
- Circuit Breaker — некритичный сервис, мягкие пороги

#### Подблок 1.3: Два эндпоинта NER

```typescript
// POST /extract — извлечение сущностей
const res = await fetch(`${this.nerUrl}/extract`, {
  method: 'POST',
  body: JSON.stringify({ texts: titles }),
  signal: AbortSignal.timeout(this.timeoutMs),
});
// Ответ: [{ PER: [...], ORG: [...], LOC: [...] }, ...]

// POST /normalize — морфологическая нормализация через pymorphy2
const res = await fetch(`${this.nerUrl}/normalize`, {
  method: 'POST',
  body: JSON.stringify({ tokens: ['встретился', 'встречи', 'встреча'] }),
  signal: AbortSignal.timeout(2000),
});
// Ответ: { tokens: ['встреча', 'встреча', 'встреча'] }
// Все формы → именительный падеж
```

---

### ⚡ Блок 2: Circuit Breaker (5 минут)

#### Подблок 2.1: Проблема без Circuit Breaker

**[Показать слайд с каскадным отказом]**

```
Без Circuit Breaker:
NER недоступен → каждый запрос ждёт 5 сек таймаут
→ 10 статей × 5 сек = 50 сек на цикл сбора
→ Очередь накапливается
→ Весь сервер тормозит
```

#### Подблок 2.2: Три состояния Circuit Breaker

**[Открыть server/infrastructure/patterns/CircuitBreaker.ts]**

```
CLOSED (нормальная работа)
  │ 10 ошибок подряд
  ▼
OPEN (сервис заблокирован)
  │ 2 минуты прошло
  ▼
HALF_OPEN (пробный запрос)
  │ 1 успех
  ▼
CLOSED (восстановлен)

При OPEN → немедленно возвращаем fallback
Нет ожидания таймаута!
```

#### Подблок 2.3: Конфигурация для NER

```typescript
// forOptionalService — мягкие пороги для некритичного сервиса
CircuitBreakerFactory.forOptionalService('NER'):
  failureThreshold: 10   // 10 ошибок (не 3 как для критичных)
  timeout: 120000        // 2 минуты в OPEN
  successThreshold: 1    // 1 успех для восстановления

// forCriticalService — жёсткие пороги для БД
CircuitBreakerFactory.forCriticalService('DB'):
  failureThreshold: 3
  timeout: 60000
  successThreshold: 3
```

#### Подблок 2.4: Использование в NerService

```typescript
private async extractBatch(titles: string[]): Promise<(ArticleEntities | null)[]> {
  return this.circuitBreaker.execute(
    // Основная операция
    async () => {
      const res = await fetch(`${this.nerUrl}/extract`, { ... });
      return await res.json() as ArticleEntities[];
    },
    // Fallback — немедленно при OPEN
    async () => {
      console.warn('🔄 NER unavailable, using fallback (empty entities)');
      return titles.map(() => null);
    }
  );
}
```

---

### 🔄 Блок 3: Graceful Degradation (5 минут)

#### Подблок 3.1: Три уровня деградации

**[Открыть server/infrastructure/ner/GracefulNerService.ts]**

```
Уровень 1: NER доступен
  → extractEntitiesForArticles() → Natasha NER
  → Точные сущности: PER, ORG, LOC

Уровень 2: NER недоступен, fallback 'simple'
  → Regex-паттерны для русского языка
  → "Имя Фамилия", "г. Москва", "ООО Компания"
  → Менее точно, но работает

Уровень 3: fallback 'keyword'
  → Словарь известных сущностей
  → ["Путин", "Газпром", "Москва", ...]
  → Только известные имена

Уровень 4: fallback 'empty'
  → { PER: [], ORG: [], LOC: [] }
  → Кластеризация без NER (только токены)
```

#### Подблок 3.2: Проверка доступности

```typescript
class GracefulNerService {
  private nerAvailable = true;
  private lastNerCheck = 0;
  private readonly checkInterval = 60000; // раз в минуту

  private async checkNerAvailability(): Promise<void> {
    const now = Date.now();
    // Не проверяем чаще раза в минуту
    if (now - this.lastNerCheck < this.checkInterval) return;

    this.lastNerCheck = now;
    const health = await nerService.healthCheck();
    this.nerAvailable = health.available;
  }
}
```

#### Подблок 3.3: Simple fallback — regex для русского

```typescript
private simpleFallback(title: string): ArticleEntities {
  const entities = { PER: [], ORG: [], LOC: [] };

  // Персоны: "Имя Фамилия" или "И.О. Фамилия"
  const personPatterns = [
    /([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+)/g,
    /([А-ЯЁ]\.\s*[А-ЯЁ]\.\s*[А-ЯЁ][а-яё]+)/g,
  ];

  // Организации: "ООО Компания", аббревиатуры
  const orgPatterns = [
    /(ООО|АО|ПАО|ЗАО)\s+[«"]?([А-ЯЁа-яё\s\-]+)[«"]?/g,
  ];

  // Локации: "г. Москва", "Петербург"
  const locationPatterns = [
    /(г\.\s*[А-ЯЁ][а-яё\-]+)/g,
    /([А-ЯЁ][а-яё\-]+(?:ск|град|бург|город))/g,
  ];

  // Дедупликация и лимит 3 сущности каждого типа
  entities.PER = [...new Set(matches)].slice(0, 3);
  // ...
  return entities;
}
```

---

### 🔗 Блок 4: Алгоритм кластеризации (7 минут)

#### Подблок 4.1: Domain Layer — NewsCluster.ts

**[Открыть server/domain/news/NewsCluster.ts]**

```typescript
// Стоп-слова — не участвуют в сравнении
const STOP_WORDS = new Set([
  'заявил', 'заявила', 'сообщил', 'рассказал', 'назвал',
  'после', 'будет', 'этого', 'также', 'более',
  'said', 'says', 'over', 'after', 'first', 'last',
  // ...
]);

const MIN_WORD_LENGTH = 4;
export const MIN_COMMON_WORDS = 2; // порог похожести

// Токенизация: lowercase → убрать спецсимволы → фильтр стоп-слов
export function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\wа-яёa-z\s]/gi, '')
      .split(/\s+/)
      .filter(w => w.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(w))
  );
}

// С морфологической нормализацией через NER
export async function tokenizeNormalized(
  title: string,
  normalize: (tokens: string[]) => Promise<string[]>
): Promise<Set<string>> {
  const raw = Array.from(tokenize(title));
  const normalized = await normalize(raw);
  return new Set(normalized);
}
```

**Ведущий:**
> Ключевой момент — `tokenizeNormalized` принимает функцию `normalize`. Если NER доступен — используем pymorphy2. Если нет — identity-функция. Graceful degradation прямо в Domain Layer.

#### Подблок 4.2: ClusterNewsUseCase — алгоритм

**[Открыть server/application/news/ClusterNewsUseCase.ts]**

```typescript
const CLUSTER_WINDOW_HOURS = 2; // кластеризуем статьи за последние 2 часа

private async clusterBucket(articles: NewsArticle[]): Promise<NewsArticle[][]> {
  // Нормализатор: NER или identity
  const normalize = nerService.isAvailable()
    ? (tokens: string[]) => nerService.normalizeTokens(tokens)
    : (tokens: string[]) => Promise.resolve(tokens);

  // O(n) запросов к NER — нормализуем все заголовки заранее
  const normalizedSets = await Promise.all(
    articles.map(a => tokenizeNormalized(a.title, normalize))
  );

  const assigned = new Set<number>();
  const groups: NewsArticle[][] = [];

  // O(n²) сравнение — но только внутри одного bucket (регион+категория)
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
      if (common >= MIN_COMMON_WORDS) { // >= 2 общих слова
        group.push(articles[j]);
        assigned.add(j);
      }
    }
    groups.push(group);
  }
  return groups;
}
```

#### Подблок 4.3: Пример кластеризации

**[Показать слайд с примером]**

```
Статьи за 2 часа (регион: russia, категория: politics):

1. "Путин провёл встречу с Байденом в Женеве"
   tokens: {путин, провёл, встреч, байден, женев}
   normalized: {путин, провести, встреча, байден, женева}

2. "Встреча Путина и Байдена завершилась в Женеве"
   tokens: {встреч, путин, байден, заверш, женев}
   normalized: {встреча, путин, байден, завершить, женева}

Общие токены: {встреча, путин, байден, женева} = 4 >= MIN_COMMON_WORDS(2)
→ КЛАСТЕР ✅

3. "Газпром повысил цены на газ"
   tokens: {газпром, повыс, цены}
   normalized: {газпром, повысить, цена}

Общих с кластером 1-2: 0 < 2
→ ОДИНОЧНАЯ СТАТЬЯ
```

#### Подблок 4.4: Разбивка по bucket

```typescript
private async groupBySimilarity(articles: NewsArticle[]): Promise<NewsArticle[][]> {
  // Сначала группируем по region:category
  const buckets = new Map<string, NewsArticle[]>();
  for (const a of articles) {
    const key = `${a.region}:${a.category}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(a);
  }

  // Кластеризуем каждый bucket отдельно
  const allGroups: NewsArticle[][] = [];
  for (const bucket of buckets.values()) {
    allGroups.push(...await this.clusterBucket(bucket));
  }
  return allGroups;
}
```

**Ведущий:**
> Разбивка по bucket — ключевая оптимизация. Российские политические новости не сравниваются с мировыми технологическими. O(n²) только внутри bucket.

---

### 🔍 Блок 5: Entity-Driven поиск похожих (4 минуты)

#### Подблок 5.1: EntityClusterService

**[Открыть server/application/news/EntityClusterService.ts]**

```typescript
// Три шага поиска похожих статей для страницы /news/:id

// Шаг 1: по FIRST-сущности (первая сущность из заголовка)
const firstTerm = article.entities?.FIRST?.[0];
if (firstTerm) {
  const byFirst = await newsArticleRepository.findByEntities({
    terms: [firstTerm],
    minMatches: 1,
    since: new Date(Date.now() - 48 * 3_600_000), // 48 часов
    excludeId: article.id,
    limit: 100,
  });
  // Фильтруем: не из того же источника, без дубликатов по заголовку
  similarArticles = filterDuplicatesFromSameSource(byFirst, article.sourceId).slice(0, 6);
}

// Шаг 2: fallback по cluster_id (если не нашли по FIRST)
if (similarArticles.length === 0 && article.clusterId) {
  const byCluster = await newsArticleRepository.findByClusterIdLimited(
    article.clusterId, 100, article.id
  );
  similarArticles = filterDuplicatesFromSameSource(byCluster, article.sourceId).slice(0, 6);
}

// Шаг 3: всегда — "Другие новости" из той же категории
const byCategory = await newsArticleRepository.findRecentByCategory(
  article.category, article.region, 3, article.id
);
```

#### Подблок 5.2: Дедупликация

```typescript
function filterDuplicatesFromSameSource(articles, excludeSourceId) {
  const seen = new Set<string>();
  return articles.filter(article => {
    if (article.sourceId === excludeSourceId) return false; // не из того же источника
    const normalized = normalizeTitle(article.title); // lowercase, убрать спецсимволы
    if (seen.has(normalized)) return false; // дубликат по заголовку
    seen.add(normalized);
    return true;
  });
}
```

---

### 📊 Блок 6: NerBatchProcessor (3 минуты)

**[Открыть server/infrastructure/ner/NerBatchProcessor.ts]**

**Ведущий:**
> Для обработки большого потока статей — адаптивный батч-процессор:

```typescript
const MIN_BATCH_SIZE = 5;
const MAX_BATCH_SIZE = 50;
const INITIAL_BATCH_SIZE = 10;

private calculateOptimalBatchSize(): number {
  const recentMetrics = this.metrics.slice(-10);
  const avgTimePerArticle = /* среднее время на статью */;
  const avgSuccessRate = /* средний процент успеха */;

  // Быстро и успешно → увеличиваем батч
  if (avgTimePerArticle < 200 && avgSuccessRate > 0.9) {
    newBatchSize = Math.min(currentBatchSize + 5, MAX_BATCH_SIZE);
  }
  // Медленно или ошибки → уменьшаем батч
  else if (avgTimePerArticle > 500 || avgSuccessRate < 0.7) {
    newBatchSize = Math.max(currentBatchSize - 3, MIN_BATCH_SIZE);
  }
  return newBatchSize;
}
```

**Ключевые моменты:**
- Адаптивный размер батча: 5–50 статей
- Метрики последних 10 батчей
- 100ms пауза между батчами
- Circuit Breaker проверяется перед каждым батчем

---

### 🎓 Заключение (1 минута)

**Ведущий:**
> Итоги AI-интеграции:

1. **NER-сервис** — отдельный Python-микросервис, батчи по 10, таймаут 5 сек
2. **Circuit Breaker** — 3 состояния, мягкие пороги для некритичного сервиса
3. **Graceful Degradation** — 4 уровня: NER → simple regex → keyword → empty
4. **Кластеризация** — токены + стоп-слова + морфология, O(n²) внутри bucket
5. **Entity-Driven** — поиск по FIRST-сущности → cluster_id → категория

> В следующем эпизоде — PWA и офлайн-режим: Service Worker, IndexedDB через Dexie.js, Web Push уведомления.

---

## 🎥 Технические требования

### Файлы для демонстрации
```
server/
├── infrastructure/
│   ├── ner/
│   │   ├── NerService.ts
│   │   ├── GracefulNerService.ts
│   │   └── NerBatchProcessor.ts
│   └── patterns/
│       └── CircuitBreaker.ts
├── application/news/
│   ├── ClusterNewsUseCase.ts
│   └── EntityClusterService.ts
└── domain/news/
    └── NewsCluster.ts
```

### Демо в браузере
- Открыть карточку новости → показать "Похожие новости"
- Открыть Zone E (Hot Entities) в мониторинге
- Показать метрики NER в Zone B (Infrastructure)
