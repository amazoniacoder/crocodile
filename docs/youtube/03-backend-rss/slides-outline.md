# Слайды для Эпизода 3: "Backend: RSS сбор и обработка"

> **Презентация:** 20-25 слайдов для 25-30 минут эпизода

---

## 🎯 Структура презентации

### Слайд 1: Заставка
```
NewsAggregator — Backend Deep Dive
Эпизод 3: "RSS сбор и обработка"

🔄 Как система собирает 15+ источников каждую минуту
⚡ Последовательная обработка с rate limiting
🛡️ Graceful degradation при ошибках
📊 Мониторинг через AlertManager
```

### Слайд 2: План эпизода
```
Что разберём сегодня:

1️⃣ Архитектура RSS сбора
2️⃣ Планировщик: fast/slow расписания
3️⃣ parseSourceFeed: RSS, Telegram, YouTube
4️⃣ RssRateLimiter: защита источников
5️⃣ Обработка ошибок и graceful degradation
6️⃣ AlertManager: независимый мониторинг
```

---

## 🔄 Блок 1: Архитектура (слайды 3-5)

### Слайд 3: Поток данных
```
node-cron (fast: */1, slow: */5)
         │
         ▼
CollectNewsUseCase.execute(group)
         │
         ├─ loadBalancer.shouldHandleCollection()  ← Redis lock
         │
         ├─ for each source (последовательно, 500ms):
         │      ├─ rssRateLimiter.canMakeRequest()
         │      ├─ parseSourceFeed(source)
         │      ├─ articleService.persistArticles()
         │      └─ statsService.recordCollection()
         │
         └─ eventBus.emit('articles.collected')
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
    WebSocket    Web Push   Clustering
```

### Слайд 4: Почему последовательно, а не параллельно
```
❌ Promise.allSettled([source1, source2, ...])
   • Перегружает источники одновременными запросами
   • Сложно контролировать нагрузку
   • Burst-запросы могут вызвать блокировку

✅ for...of с задержкой 500ms
   • Защита источников от перегрузки
   • Предсказуемое потребление памяти
   • Простой мониторинг прогресса
   • RssRateLimiter работает эффективнее
```

### Слайд 5: Группы источников
```
Fast (*/1 * * * *)          Slow (*/5 * * * *)
┌─────────────────────┐    ┌─────────────────────┐
│ lenta.ru            │    │ guardian.com         │
│ rbc.ru              │    │ al-jazeera.com       │
│ habr.com            │    │ reuters.com          │
│ youtube.com         │    │ tass.ru              │
│ primamedia.ru       │    │ ...                  │
└─────────────────────┘    └─────────────────────┘

Определяется по домену в isFastSource()
Расписание хранится в source_config (БД)
Меняется без перезапуска сервера
```

---

## 📰 Блок 2: parseSourceFeed (слайды 6-9)

### Слайд 6: Функция, не класс
```typescript
// ✅ Чистая функция без состояния
export async function parseSourceFeed(
  source: NewsSource
): Promise<ParsedFeed> {
  // ...
}

// Два инстанса парсера на уровне модуля
const parserStrict  = new Parser({ xml2js: { strict: true } });
const parserLenient = new Parser({ xml2js: { strict: false } });
```

### Слайд 7: Strict → Lenient fallback
```
parserStrict.parseURL(source.rssUrl)
         │
         ├─ OK → продолжаем
         │
         └─ XML-ошибка? (Attribute without value,
                          Invalid character)
                    │
                    ▼
         parserLenient.parseURL(source.rssUrl)
                    │
                    ├─ OK → продолжаем
                    │
                    └─ Сетевая ошибка → throw
                       (обрабатывает RssCollectionService)
```

### Слайд 8: Один парсер — три типа источников
```
sourceType: 'rss'
  • region/category из source
  • imageUrl из media:content / enclosure

sourceType: 'telegram'
  • channelUsername + messageId из URL t.me/...
  • description из feed.description

sourceType: 'youtube'
  • videoId из yt:videoId или URL
  • thumbnail из media:group или ytimg.com
  • imageUrl генерируется автоматически

Специальный случай: rbc.ru
  • region/category из поля newsline
  • Маппинг: politics→politics, world→other...
```

### Слайд 9: Минимальная валидация
```typescript
for (const item of feed.items.slice(0, 50)) {
  const url   = item.link?.trim();
  const title = item.title?.trim();

  // Только два обязательных поля
  if (!url || !title) continue;

  // Всё остальное — опционально
  articles.push({ sourceId, title, url, ... });
}

// Без исключений — просто пропускаем невалидные
// Без лимита длины заголовка — доверяем источнику
```

---

## 🚦 Блок 3: RssRateLimiter (слайды 10-12)

### Слайд 10: Двухуровневый rate limiter
```
Redis (персистентный)
  └─ ratelimit:{domain}     ← счётчики запросов
  └─ ratelimit:timestamps:{domain} ← burst detection

Memory Cache (fallback)
  └─ Map<domain, RateLimitState>

При недоступности Redis → работает из памяти
```

### Слайд 11: Per-domain конфигурация
```
lenta.ru:  30 req/min, burst: 5,  backoff: 2.0x, max: 60min
rbc.ru:    20 req/min, burst: 3,  backoff: 2.0x, max: 60min
habr.com:  15 req/min, burst: 3,  backoff: 1.8x, max: 45min
default:   10 req/min, burst: 2,  backoff: 2.5x, max: 120min

Три проверки перед запросом:
1. Backoff period (после серии ошибок)
2. Минутный лимит (sliding window)
3. Burst лимит (последние 10 секунд)
```

### Слайд 12: Exponential backoff
```
Ошибки которые вызывают backoff:
503, 429, 502, 504
ECONNREFUSED, ETIMEDOUT, ENOTFOUND
"Too Many Requests", "Заблокировано"

Формула: min(backoffMultiplier ^ (errors-1), maxMinutes)

Пример для default (2.5x, max 120min):
  1 ошибка → 1 мин
  2 ошибки → 2.5 мин
  3 ошибки → 6.25 мин
  4 ошибки → 15.6 мин
  5+ ошибок → 120 мин (cap)
```

---

## ⚠️ Блок 4: Обработка ошибок (слайды 13-15)

### Слайд 13: Три типа результата
```typescript
// 1. Rate limited
{ rateLimited: true, retryAfter: 120, articles: [] }
→ statsService.recordRateLimitedCollection()

// 2. Ошибка сети/парсинга
{ error: 'Таймаут', articles: [] }
→ statsService.recordFailedCollection()
→ rssRateLimiter.recordError()

// 3. Пустая лента
{ articles: [] }  // без error
→ statsService.recordEmptyFeedCollection()

// 4. Успех
{ articles: [...], feedMeta: {...} }
→ persistArticles() → processEntities()
```

### Слайд 14: Классификация ошибок
```typescript
classifyError(error):
  503 → "Заблокировано (503)"
  404 → "Не найдено (404)"
  401/403 → "Доступ запрещён"
  ECONNREFUSED → "Соединение отклонено"
  ENOTFOUND → "Хост недоступен"
  ETIMEDOUT → "Таймаут"
  Invalid XML → "Невалидный XML"
  default → message.slice(0, 100)

isNetworkError(): ENOTFOUND || ECONNREFUSED || timed out
→ console.warn (не error) — ожидаемое поведение
```

### Слайд 15: Таймаут 8 секунд
```typescript
// RssCollectionService
const SOURCE_FETCH_TIMEOUT_MS = 8000;

const { articles } = await this.withTimeout(
  parseSourceFeed(source),
  SOURCE_FETCH_TIMEOUT_MS,
  source.name
);

// parseSourceFeed имеет свой таймаут 5с на уровне парсера
// withTimeout — внешний guard на уровне сервиса
// Два уровня защиты от зависших источников
```

---

## 📊 Блок 5: AlertManager (слайды 16-18)

### Слайд 16: Независимый процесс
```
CollectNewsUseCase          AlertManager
      │                          │
      │ emit('articles.collected')│ setInterval(30s)
      │                          │
      ▼                          ▼
  EventBus              collectSystemMetrics()
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
             lastCycleAt  rateLimiter  cluster
                    │
                    ▼
             evaluateRules() → triggerAlert()
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
                    WebSocket              Webhook
                   (всегда)          (если ALERT_WEBHOOK_URL)
```

### Слайд 17: RSS-правила AlertManager
```
rss-collection-stalled  critical  cooldown: 15min
  → lastCollectedAt > 30 минут назад

high-error-rate         warning   cooldown: 10min
  → sourcesWithErrors / totalSources > 0.5

low-article-count       warning   cooldown: 60min
  → articlesLast24h < 100

rate-limit-issues       warning   cooldown: 15min
  → backedOffDomains > 2

+ 13 других правил: SSL, disk, Fail2Ban,
  cluster, memory, Redis, database...
```

### Слайд 18: Cooldown механизм
```
Алерт НЕ срабатывает повторно пока:
  now - lastTriggered < cooldownMs

Алерт РАЗРЕШАЕТСЯ автоматически когда:
  condition(metrics) → false

При разрешении:
  → alert.resolvedAt = now
  → WebSocket: 'alert_resolved'
  → Redis: обновление записи (TTL 7 дней)
```

---

## 🚀 Блок 6: Производительность (слайды 19-21)

### Слайд 19: Метрики реального цикла
```
Типичный fast-цикл (10 источников):
  Общее время: 8-15 секунд
  На источник: 0.5-2 секунды
  Задержка между: 500ms × 10 = 5 секунд
  Таймаут guard: 8 секунд

Prometheus метрики:
  rss_collection_duration_seconds
  rss_articles_collected_total{source, region, category}
  rss_collection_errors_total{source, error_type}
  rss_collection_last_success_timestamp
```

### Слайд 20: Кластерная координация
```
Redis lock: collection:{group}:{timestamp}
  SET key nodeId PX 60000 NX

Только одна нода выполняет сбор:
  shouldHandleCollection() → true/false

После завершения:
  releaseCollectionLock(group)

Группы telegram/youtube — без lock
(каждая нода собирает независимо)
```

### Слайд 21: Дедупликация в БД
```sql
-- UNIQUE constraint по URL
INSERT INTO news_articles (title, url, ...)
VALUES ($1, $2, ...)
ON CONFLICT (url) DO NOTHING
RETURNING id;

-- null → дубликат, duplicateCount++
-- объект → новая статья, insertedCount++

Типичное соотношение:
  ~30% новых статей
  ~70% дубликатов (уже в БД)
```

---

## 🎓 Заключение (слайды 22-24)

### Слайд 22: Ключевые принципы
```
✅ Последовательность вместо параллелизма
   → защита источников, предсказуемость

✅ Функция вместо класса для парсера
   → чистота, тестируемость, без состояния

✅ Per-domain rate limiting с Redis
   → разные лимиты для разных источников

✅ AlertManager независим от сбора
   → проактивный мониторинг каждые 30 сек
```

### Слайд 23: Реальные цифры
```
📊 Production метрики:

• 15+ источников за 8-15 секунд
• 500ms задержка между источниками
• 8 секунд таймаут на источник
• 30 секунд интервал AlertManager
• 17 правил алертов
• 4 события в EventBus
• 20 таблиц в PostgreSQL
```

### Слайд 24: Анонс следующего эпизода
```
🎬 Эпизод 4: "Frontend: React + TypeScript"

⚛️ Виртуализированная лента (@tanstack/react-virtual)
🔄 Zustand: состояние без Redux
🌐 Wouter: роутинг с синхронизацией URL
📱 PWA: Service Worker, IndexedDB (Dexie.js)
🔔 WebSocket: real-time уведомления

Подписывайтесь! 👍
```

---

## 🎨 Дизайн-система

### Цветовая схема
- **Успех/OK:** `#22c55e`
- **Ошибка:** `#ef4444`
- **Rate limit/Warning:** `#f59e0b`
- **Info:** `#3b82f6`
- **Fast источники:** `#10b981`
- **Slow источники:** `#6b7280`

### Типографика
- **Заголовки:** Inter Bold, 32px
- **Текст:** Inter Regular, 18px
- **Код:** JetBrains Mono, 16px

---

*Слайды основаны на реальном production-коде проекта.*
