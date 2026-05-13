# Диаграммы для Эпизода 5: "AI интеграция: NER и кластеризация"

---

## 📊 Диаграмма 1: Общий поток AI-обработки

```
Новая статья сохранена в БД
         │
         ▼
ArticleManagementService.processEntities()
         │
         ▼
gracefulNerService.processEntities([{id, title}])
         │
         ├─ NER доступен?
         │    ├─ ДА → nerService.extractEntitiesForArticles()
         │    │         └─ POST /extract → Natasha NER
         │    │              └─ { PER, ORG, LOC }
         │    └─ НЕТ → fallback стратегия
         │              ├─ 'simple'  → regex-паттерны
         │              ├─ 'keyword' → словарь сущностей
         │              └─ 'empty'   → { PER:[], ORG:[], LOC:[] }
         │
         ▼
newsArticleRepository.updateEntities(articleId, entities)
         │
         ▼
eventBus.emit('articles.collected')
         │
         ▼
ClusterNewsUseCase.execute()
         │
         ▼
Кластеризация за последние 2 часа
```

---

## 📊 Диаграмма 2: Circuit Breaker — три состояния

```
         CLOSED
    (нормальная работа)
         │
         │ 10 ошибок подряд
         ▼
         OPEN
    (сервис заблокирован)
    немедленный fallback
         │
         │ 2 минуты прошло
         ▼
       HALF_OPEN
    (пробный запрос)
         │
         ├─ Успех → CLOSED (восстановлен)
         └─ Ошибка → OPEN (снова заблокирован)

Конфигурация для NER (forOptionalService):
  failureThreshold: 10   ← мягко
  timeout: 120000ms      ← 2 минуты
  successThreshold: 1    ← быстрое восстановление

Конфигурация для БД (forCriticalService):
  failureThreshold: 3    ← жёстко
  timeout: 60000ms
  successThreshold: 3
```

---

## 📊 Диаграмма 3: Graceful Degradation — четыре уровня

```
Уровень 1: NER доступен
┌─────────────────────────────────────────┐
│ POST http://ner-service:8001/extract    │
│ { texts: ["Путин встретился с Байденом"] }│
│                                         │
│ Ответ: { PER: ["Путин", "Байден"],     │
│           LOC: ["Женева"], ORG: [] }    │
│ Точность: высокая                       │
└─────────────────────────────────────────┘

Уровень 2: fallback 'simple' (regex)
┌─────────────────────────────────────────┐
│ /([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+)/g   │
│ → "Путин Байден" (неточно)             │
│ Точность: средняя                       │
└─────────────────────────────────────────┘

Уровень 3: fallback 'keyword' (словарь)
┌─────────────────────────────────────────┐
│ knownPersons: ["Путин", "Байден", ...]  │
│ → найдено в заголовке                   │
│ Точность: только известные сущности     │
└─────────────────────────────────────────┘

Уровень 4: fallback 'empty'
┌─────────────────────────────────────────┐
│ { PER: [], ORG: [], LOC: [] }           │
│ Кластеризация работает без NER          │
│ (только токенное сравнение)             │
└─────────────────────────────────────────┘
```

---

## 📊 Диаграмма 4: Алгоритм кластеризации

```
Входные данные: некластеризованные статьи за 2 часа

Шаг 1: Разбивка по bucket (O(n))
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│russia:politics  │  │russia:economy   │  │world:other      │
│  статья 1       │  │  статья 4       │  │  статья 6       │
│  статья 2       │  │  статья 5       │  │  статья 7       │
│  статья 3       │  └─────────────────┘  └─────────────────┘
└─────────────────┘

Шаг 2: Нормализация токенов (O(n) запросов к NER)
  статья 1: tokenize → normalize → Set{"путин", "встреча", "байден"}
  статья 2: tokenize → normalize → Set{"встреча", "путин", "байден", "женева"}
  статья 3: tokenize → normalize → Set{"газпром", "цена", "газ"}

Шаг 3: Попарное сравнение внутри bucket (O(n²))
  статья 1 vs статья 2: общих = 3 >= MIN_COMMON_WORDS(2) → КЛАСТЕР ✅
  статья 1 vs статья 3: общих = 0 < 2 → разные
  статья 2 vs статья 3: общих = 0 < 2 → разные

Результат:
  Кластер: [статья 1, статья 2]
  Одиночная: статья 3
```

---

## 📊 Диаграмма 5: Entity-Driven поиск похожих

```
Запрос: GET /news/12345

Шаг 1: FIRST-сущность
  article.entities.FIRST[0] = "Путин"
  findByEntities({ terms: ["Путин"], since: -48h, limit: 100 })
  → 15 статей с упоминанием "Путин"
  → filterDuplicatesFromSameSource() → 12 статей
  → slice(0, 6) → 6 похожих статей ✅

Шаг 2: cluster_id fallback (если FIRST не дал результат)
  article.clusterId = 42
  findByClusterIdLimited(42, 100, excludeId=12345)
  → статьи из того же кластера

Шаг 3: "Другие новости" (всегда)
  findRecentByCategory('politics', 'russia', 3, excludeId=12345)
  → 3 свежие статьи той же категории

Ответ:
  similarArticles: [6 статей по FIRST-сущности]
  otherArticles: [3 статьи из категории]
```

---

## 📊 Диаграмма 6: NerBatchProcessor — адаптивный размер

```
Начальный размер батча: 10

Метрики последних 10 батчей:
  avgTimePerArticle < 200ms && successRate > 90%
  → увеличить: +5 (max 50)

  avgTimePerArticle > 500ms || successRate < 70%
  → уменьшить: -3 (min 5)

Пример адаптации:
  Батч 1-3:  size=10, time=150ms, rate=95% → size=15
  Батч 4-6:  size=15, time=120ms, rate=98% → size=20
  Батч 7:    size=20, time=600ms, rate=60% → size=17
  Батч 8-10: size=17, time=180ms, rate=92% → size=22

100ms пауза между батчами
Circuit Breaker проверяется перед каждым батчем
```

---

*Диаграммы основаны на реальной реализации проекта.*
