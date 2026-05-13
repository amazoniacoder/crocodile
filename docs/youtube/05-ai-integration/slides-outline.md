# Слайды для Эпизода 5: "AI интеграция: NER и кластеризация"

> **Презентация:** 22-24 слайда для 25-30 минут эпизода

---

### Слайд 1: Заставка
```
NewsAggregator — AI Integration
Эпизод 5: "NER и кластеризация"

🧠 NER-сервис: FastAPI + Natasha + pymorphy2
⚡ Circuit Breaker: защита от каскадных отказов
🔄 Graceful Degradation: 4 уровня fallback
🔗 Кластеризация: токены + морфология
🔍 Entity-Driven: поиск похожих статей
```

### Слайд 2: Что такое NER
```
Named Entity Recognition

Вход: "Путин встретился с Байденом в Женеве"

Выход:
  PER: ["Путин", "Байден"]
  ORG: []
  LOC: ["Женева"]

Зачем:
  ✅ Группировать статьи по смыслу
  ✅ Находить похожие новости
  ✅ Строить "горячие сущности" за 24ч
```

---

## Блок 1: NER-сервис (слайды 3-5)

### Слайд 3: Архитектура
```
Node.js сервер
      │
      │ POST /extract (батч 10 заголовков)
      │ POST /normalize (токены → именительный падеж)
      ▼
Python FastAPI (порт 8001)
      │
      ├─ Natasha NER → PER, ORG, LOC
      └─ pymorphy2 → морфологическая нормализация

Конфигурация:
  NER_SERVICE_URL=http://ner-service:8001
  NER_BATCH_SIZE=10
  NER_TIMEOUT_MS=5000
```

### Слайд 4: pymorphy2 — зачем нужна нормализация
```
Без нормализации:
  "встретился" ≠ "встречи" ≠ "встреча"
  → статьи не кластеризуются

С pymorphy2:
  "встретился" → "встреча"
  "встречи"    → "встреча"
  "встреча"    → "встреча"
  → все формы → именительный падеж
  → статьи кластеризуются ✅

Аналогично для имён:
  "Путина" → "Путин"
  "Путину" → "Путин"
```

### Слайд 5: Батчевая обработка
```typescript
// 10 заголовков за один HTTP-запрос
for (let i = 0; i < articles.length; i += batchSize) {
  const batch = articles.slice(i, i + batchSize);
  const entities = await extractBatch(batch.map(a => a.title));
  batch.forEach((article, idx) => {
    result.set(article.id, entities[idx]);
  });
}

// Вместо 10 запросов → 1 запрос
// Экономия: 90% HTTP overhead
```

---

## Блок 2: Circuit Breaker (слайды 6-9)

### Слайд 6: Проблема без Circuit Breaker
```
NER недоступен:

Без Circuit Breaker:
  Каждый запрос → ждёт 5 сек таймаут
  10 статей × 5 сек = 50 сек на цикл
  Очередь накапливается
  Весь сервер тормозит ❌

С Circuit Breaker:
  После 10 ошибок → OPEN
  Следующие запросы → немедленный fallback
  Цикл сбора: нормальная скорость ✅
```

### Слайд 7: Три состояния
```
CLOSED → нормальная работа
  │ 10 ошибок
  ▼
OPEN → немедленный fallback
  │ 2 минуты
  ▼
HALF_OPEN → пробный запрос
  │ 1 успех → CLOSED
  │ ошибка  → OPEN
```

### Слайд 8: Конфигурации
```
forOptionalService (NER):
  failureThreshold: 10   ← мягко
  timeout: 120s          ← 2 минуты
  successThreshold: 1    ← быстрое восстановление

forCriticalService (БД):
  failureThreshold: 3    ← жёстко
  timeout: 60s
  successThreshold: 3    ← медленное восстановление

forHttpService (внешние API):
  failureThreshold: 5
  timeout: 30s
  successThreshold: 2
```

### Слайд 9: Код Circuit Breaker
```typescript
async execute<T>(operation, fallback?) {
  if (this.state === 'OPEN') {
    if (shouldAttemptReset()) {
      this.state = 'HALF_OPEN';
    } else {
      // Немедленный fallback — не ждём таймаут!
      return fallback ? await fallback() : throw error;
    }
  }

  try {
    const result = await operation();
    this.onSuccess(); // HALF_OPEN → CLOSED при successThreshold
    return result;
  } catch {
    this.onFailure(); // CLOSED → OPEN при failureThreshold
    return fallback ? await fallback() : throw;
  }
}
```

---

## Блок 3: Graceful Degradation (слайды 10-12)

### Слайд 10: Четыре уровня
```
1. NER доступен
   → Natasha NER: точные PER, ORG, LOC

2. fallback 'simple'
   → Regex: "Имя Фамилия", "г. Москва", "ООО Название"
   → Менее точно, но работает

3. fallback 'keyword'
   → Словарь: ["Путин", "Газпром", "Москва", ...]
   → Только известные сущности

4. fallback 'empty'
   → { PER: [], ORG: [], LOC: [] }
   → Кластеризация только по токенам
```

### Слайд 11: Проверка доступности
```typescript
// Не чаще раза в минуту
private async checkNerAvailability() {
  if (Date.now() - this.lastNerCheck < 60000) return;
  this.lastNerCheck = Date.now();

  const health = await nerService.healthCheck();
  this.nerAvailable = health.available;
}

// GET /health → { available: true, responseTime: 45 }
// Таймаут: 2 секунды
```

### Слайд 12: Retry логика
```typescript
private async processWithRetries(articles) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await nerService.extractEntitiesForArticles(articles);
    } catch (error) {
      if (attempt < maxRetries) {
        await delay(retryDelay * attempt); // 1s, 2s
      }
    }
  }
  throw lastError; // → переключаемся на fallback
}

// maxRetries: 2
// retryDelay: 1000ms
```

---

## Блок 4: Кластеризация (слайды 13-17)

### Слайд 13: Стоп-слова
```
Не участвуют в сравнении:
  "заявил", "сообщил", "рассказал", "назвал"
  "после", "будет", "этого", "также"
  "said", "says", "over", "after", "first"

Минимальная длина слова: 4 символа
Порог похожести: MIN_COMMON_WORDS = 2

Пример:
  "Путин заявил о встрече с Байденом"
  tokens: {путин, встреч, байден}
  (заявил — стоп-слово, о — < 4 символов)
```

### Слайд 14: tokenizeNormalized
```typescript
// Принимает функцию normalize — DI через параметр
export async function tokenizeNormalized(
  title: string,
  normalize: (tokens: string[]) => Promise<string[]>
): Promise<Set<string>> {
  const raw = Array.from(tokenize(title));
  const normalized = await normalize(raw);
  return new Set(normalized);
}

// NER доступен:
normalize = (tokens) => nerService.normalizeTokens(tokens)

// NER недоступен:
normalize = (tokens) => Promise.resolve(tokens) // identity
```

### Слайд 15: Разбивка по bucket
```
Зачем bucket?

Без bucket: O(n²) по всем статьям
  100 статей → 4,950 сравнений

С bucket (region:category):
  russia:politics: 20 статей → 190 сравнений
  russia:economy:  15 статей → 105 сравнений
  world:other:     10 статей → 45 сравнений
  Итого: 340 сравнений (в 14 раз меньше!)

Плюс: российские политические новости
не сравниваются с мировыми технологическими
```

### Слайд 16: Пример кластеризации
```
Статьи (russia:politics):

1. "Путин провёл встречу с Байденом в Женеве"
   normalized: {путин, провести, встреча, байден, женева}

2. "Встреча Путина и Байдена завершилась в Женеве"
   normalized: {встреча, путин, байден, завершить, женева}

Общие: {встреча, путин, байден, женева} = 4 >= 2 → КЛАСТЕР ✅

3. "Газпром повысил цены на газ"
   normalized: {газпром, повысить, цена}

Общих с 1-2: 0 < 2 → ОДИНОЧНАЯ
```

### Слайд 17: Запуск кластеризации
```typescript
// Запускается после каждого цикла сбора
eventBus.on('articles.collected', async () => {
  await clusterNewsUseCase.execute();
});

// Только некластеризованные за последние 2 часа
const unclustered = await newsArticleRepository.findUnclustered(windowStart);

// После кластеризации → инвалидация кэша
eventBus.emit('cluster.updated', { clustersCreated, ... });
// → initCacheSubscriber: invalidateByTags(['news', 'clusters'])
```

---

## Блок 5: Entity-Driven поиск (слайды 18-19)

### Слайд 18: Три шага поиска
```
GET /news/12345

Шаг 1: FIRST-сущность (48 часов)
  entities.FIRST[0] = "Путин"
  → findByEntities({ terms: ["Путин"], minMatches: 1 })
  → 6 статей из разных источников ✅

Шаг 2: cluster_id fallback
  (если FIRST не дал результат)
  clusterId = 42
  → findByClusterIdLimited(42, ...)

Шаг 3: "Другие новости" (всегда)
  → findRecentByCategory('politics', 'russia', 3)
```

### Слайд 19: Дедупликация
```typescript
function filterDuplicatesFromSameSource(articles, excludeSourceId) {
  const seen = new Set<string>();
  return articles.filter(article => {
    // Не из того же источника
    if (article.sourceId === excludeSourceId) return false;
    // Не дубликат по заголовку
    const normalized = normalizeTitle(article.title);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

// Показываем разные точки зрения на одно событие
// Не показываем одно и то же из разных лент одного СМИ
```

---

## Заключение (слайды 20-22)

### Слайд 20: Ключевые решения
```
✅ Отдельный Python-микросервис
   → Python лучше для ML, независимое масштабирование

✅ Circuit Breaker для некритичного сервиса
   → Мягкие пороги, система работает без NER

✅ Четыре уровня Graceful Degradation
   → NER → simple → keyword → empty

✅ tokenizeNormalized с DI через параметр
   → Graceful degradation прямо в Domain Layer

✅ Bucket-разбивка перед O(n²)
   → Оптимизация без усложнения алгоритма
```

### Слайд 21: Реальные метрики
```
NER батч (10 заголовков): ~200-500ms
Нормализация токенов: ~50ms
Кластеризация 50 статей: ~2-5 сек
Circuit Breaker threshold: 10 ошибок
Fallback стратегия: 'simple' (по умолчанию)
Окно кластеризации: 2 часа
Окно Entity-поиска: 48 часов
```

### Слайд 22: Анонс Эпизода 6
```
🎬 Эпизод 6: "PWA и офлайн-режим"

📱 Service Worker (injectManifest, Workbox)
💾 IndexedDB через Dexie.js
🔔 Web Push уведомления (VAPID)
📲 PWA Badge — счётчик на иконке
🔄 Синхронизация при восстановлении сети

Подписывайтесь! 👍
```

---

## 🎨 Дизайн-система

- **NER/AI:** `#8b5cf6` (фиолетовый)
- **Circuit Breaker CLOSED:** `#22c55e`
- **Circuit Breaker OPEN:** `#ef4444`
- **Circuit Breaker HALF_OPEN:** `#f59e0b`
- **Fallback:** `#6b7280` (серый)

---

*Слайды основаны на реальном production-коде проекта.*
