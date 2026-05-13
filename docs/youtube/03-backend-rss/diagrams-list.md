# Диаграммы для Эпизода 3: "Backend: RSS сбор и обработка"

> **Цель:** Визуализация процессов RSS сбора и мониторинга

---

## 📊 Диаграмма 1: Архитектура RSS сбора

### Содержание
```
RSS Collection Architecture

┌──────────────────────────────────────────────────────────┐
│  node-cron                                               │
│  fast: "* * * * *"  (каждую минуту)                     │
│  slow: "*/5 * * * *" (каждые 5 минут)                   │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  CollectNewsUseCase.execute(group)                       │
│                                                          │
│  1. isCycleRunning()? → skip                            │
│  2. loadBalancer.shouldHandleCollection() ← Redis lock  │
│  3. getSourcesToProcess(group)                          │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  for each source (последовательно, 500ms задержка)       │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Lenta.ru │→ │  RBC     │→ │  ТАСС   │→ │  ...   │  │
│  │  (fast)  │  │  (fast)  │  │  (fast) │  │        │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│                                                          │
│  Для каждого источника:                                  │
│  rssRateLimiter.canMakeRequest(domain)                  │
│       ↓                                                  │
│  parseSourceFeed(source)  ← strict → lenient fallback   │
│       ↓                                                  │
│  articleService.persistArticles()                       │
│       ↓                                                  │
│  articleService.processEntities()  ← NER               │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  eventBus.emit('articles.collected')                     │
└──────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Cache      │    │  WebSocket  │    │  Web Push   │
│ Invalidation│    │  Broadcast  │    │Notifications│
└─────────────┘    └─────────────┘    └─────────────┘

┌──────────────────────────────────────────────────────────┐
│  AlertManager (независимо, каждые 30 сек)                │
│  ← collectNewsUseCase.lastCycleAt                        │
│  ← rssRateLimiter.getAllStats()                          │
└──────────────────────────────────────────────────────────┘
```

### Визуальные элементы
- Цветовое кодирование fast/slow источников
- Акцент на последовательность (не параллельность) обработки
- AlertManager как отдельный независимый процесс

---

## 📊 Диаграмма 2: Планировщик и расписания

### Содержание
```
Scheduler Strategy

Fast Sources (every minute)          Slow Sources (every 5 minutes)
┌─────────────────────────────┐     ┌─────────────────────────────┐
│ • Lenta.ru                  │     │ • Habr                      │
│ • RBC                       │     │ • The Guardian              │
│ • ТАСС                      │     │ • Al Jazeera                │
│ • Reuters (breaking)        │     │ • Medium                    │
│                             │     │ • Dev.to                    │
│ High frequency updates      │     │ Lower frequency updates     │
│ News agencies              │     │ Thematic resources          │
└─────────────────────────────┘     └─────────────────────────────┘
           │                                   │
           ▼                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ScheduleManagementService                    │
│                                                                 │
│  getFastSources(): NewsSource[]                                │
│  getSlowSources(): NewsSource[]                                │
│  updateSchedule(sourceId, schedule): void                      │
│                                                                 │
│  Database: source_config table                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ fast_interval_cron: "*/1 * * * *"                      │   │
│  │ slow_interval_cron: "*/5 * * * *"                      │   │
│  │ collection_enabled: true                                │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

Timeline Example:
00:00 ──── Fast ──── 00:01 ──── Fast ──── 00:02 ──── Fast ────
  │                    │                    │
  └── Slow ────────────┼────────────────────┼──── Slow ────
                       │                    │
               Both run together    Only Fast runs
```

### Визуальные элементы
- Временная шкала с метками
- Разные цвета для fast/slow
- Примеры источников в каждой категории

---

## 📊 Диаграмма 3: parseSourceFeed — детальный поток

### Содержание
```
parseSourceFeed(source: NewsSource): Promise<ParsedFeed>

Input: NewsSource (rssUrl, sourceType, region, category)
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│  parserStrict.parseURL(source.rssUrl)                   │
│  • timeout: 5000ms                                      │
│  • User-Agent: Mozilla/5.0 Chrome/120                  │
│  • customFields: media:content, yt:videoId, enclosure  │
└─────────────────────────────────────────────────────────┘
     │
     ├─ XML-ошибка? (Attribute without value, Invalid char)
     │       ↓
     │  parserLenient.parseURL(source.rssUrl)  ← fallback
     │  { strict: false }                                  
     │
     ├─ Сетевая ошибка? → throw (обрабатывает RssCollectionService)
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│  feed.items.slice(0, 50)  ← максимум 50 статей          │
│                                                         │
│  For each item:                                         │
│  1. if (!url || !title) continue  ← минимальная проверка│
│                                                         │
│  2. Специальная логика по sourceType:                   │
│     • rss:      region/category из source               │
│     • rbc.ru:   region/category из поля newsline        │
│     • telegram: channelUsername + messageId из URL      │
│     • youtube:  videoId из yt:videoId или URL           │
│                                                         │
│  3. sanitizeHtml(description) → slice(0, 500)          │
│  4. extractImageUrl(item)  ← media:content / enclosure │
└─────────────────────────────────────────────────────────┘
     │
     ▼
Output: { articles: NewArticleInput[], feedMeta }

Без побочных эффектов — не пишет в БД, не эмитит события
```

### Визуальные элементы
- Акцент: это функция, не класс
- Три ветки sourceType с разной логикой
- Отличие от retry-логики (retry — в RssCollectionService через таймаут)

---

## 📊 Диаграмма 4: Обработка ошибок и Graceful Degradation

### Содержание
```
Error Handling — последовательная обработка источников

  source[0]: lenta.ru
  ┌─────────────────────────────────────────────────────┐
  │ rssRateLimiter.canMakeRequest('lenta.ru')           │
  │   → allowed: true                                   │
  │ parseSourceFeed(source)  → 15 статей               │
  │ persistArticles()        → 12 новых, 3 дубля       │
  │ statsService.recordSuccessfulCollection()           │
  └─────────────────────────────────────────────────────┘
  ↓ 500ms задержка

  source[1]: rbc.ru
  ┌─────────────────────────────────────────────────────┐
  │ rssRateLimiter.canMakeRequest('rbc.ru')             │
  │   → allowed: false (backoff после 503)             │
  │ return { rateLimited: true, retryAfter: 120 }       │
  │ statsService.recordRateLimitedCollection()          │
  └─────────────────────────────────────────────────────┘
  ↓ 500ms задержка

  source[2]: habr.com
  ┌─────────────────────────────────────────────────────┐
  │ rssRateLimiter.canMakeRequest('habr.com')           │
  │   → allowed: true                                   │
  │ parseSourceFeed(source)                             │
  │   → parserStrict: XML-ошибка                       │
  │   → parserLenient: fallback → 8 статей             │
  │ persistArticles()        → 8 новых                 │
  └─────────────────────────────────────────────────────┘
  ↓ 500ms задержка

  source[3]: guardian.com
  ┌─────────────────────────────────────────────────────┐
  │ parseSourceFeed(source)                             │
  │   → Timeout after 8000ms                           │
  │ rssRateLimiter.recordError('guardian.com', 'Таймаут')│
  │   → consecutiveErrors++, backoff = 2.5^1 = 2.5 мин│
  │ statsService.recordFailedCollection()              │
  └─────────────────────────────────────────────────────┘

AlertManager (через 30 сек, независимо):
  ┌─────────────────────────────────────────────────────┐
  │ rssRateLimiter.getAllStats()                        │
  │   → backedOffDomains: 2 (rbc.ru, guardian.com)     │
  │   → rule 'rate-limit-issues': backedOff > 2? NO    │
  │                                                     │
  │ collectNewsUseCase.lastCycleAt                      │
  │   → timeSince < 30 мин? OK                         │
  │   → rule 'rss-collection-stalled': NOT triggered   │
  └─────────────────────────────────────────────────────┘
```

### Визуальные элементы
- Акцент на последовательность (не Promise.allSettled)
- Показать что AlertManager работает отдельно от цикла
- Exponential backoff с реальными числами из конфига

---

## 📊 Диаграмма 5: Мониторинг Dashboard

### Содержание
```
Real-time Monitoring Dashboard

┌─────────────────────────────────────────────────────────────────┐
│                        Parser Health                            │
│                                                                 │
│  Last 24 Hours:                                                 │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐     │
│  │   Source    │   Status    │  Articles   │ Error Rate  │     │
│  ├─────────────┼─────────────┼─────────────┼─────────────┤     │
│  │ Lenta.ru    │     🟢      │    347      │     0%      │     │
│  │ RBC         │     🟡      │    156      │    12%      │     │
│  │ ТАСС        │     🟢      │    289      │     2%      │     │
│  │ Habr        │     🔴      │     23      │    67%      │     │
│  │ Guardian    │     🟢      │    198      │     5%      │     │
│  └─────────────┴─────────────┴─────────────┴─────────────┘     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Collection Timing                            │
│                                                                 │
│  Average Collection Time (last 50 cycles):                     │
│                                                                 │
│   60s ┤                                                        │
│       │     ●                                                  │
│   45s ┤   ●   ●     ●                                          │
│       │ ●       ● ●   ●   ●                                    │
│   30s ┤           ●     ● ● ● ●   ●                            │
│       │                       ● ● ● ●                         │
│   15s ┤                             ● ● ●                     │
│       │                                   ●                   │
│    0s └─────────────────────────────────────────────────────   │
│       12:00  12:30  13:00  13:30  14:00  14:30  15:00        │
│                                                                 │
│  Current: 28s | Average: 34s | P95: 52s                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Active Alerts                              │
│                                                                 │
│  🟡 Warning: Habr.com error rate > 50% (last 2 hours)         │
│  🟢 Info: Collection completed successfully (28s)              │
│  🟢 Info: 47 new articles processed                            │
│                                                                 │
│  Alert History: 3 warnings, 0 critical (last 24h)            │
└─────────────────────────────────────────────────────────────────┘
```

### Визуальные элементы
- Таблицы с цветовыми индикаторами
- Графики временных рядов
- Статусные иконки

---

## 📊 Диаграмма 6: Горизонтальное масштабирование

### Содержание
```
Horizontal Scaling Architecture

┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer                            │
│                         (Nginx)                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│      Node 1         │ │      Node 2         │ │      Node 3         │
│   (Primary)         │ │   (Secondary)       │ │   (Secondary)       │
│                     │ │                     │ │                     │
│ CollectNewsUseCase  │ │ CollectNewsUseCase  │ │ CollectNewsUseCase  │
│                     │ │                     │ │                     │
│ ┌─────────────────┐ │ │ ┌─────────────────┐ │ │ ┌─────────────────┐ │
│ │ Redis Lock      │ │ │ │ Redis Lock      │ │ │ │ Redis Lock      │ │
│ │ ✅ ACQUIRED     │ │ │ │ ❌ WAITING      │ │ │ │ ❌ WAITING      │ │
│ └─────────────────┘ │ │ └─────────────────┘ │ │ └─────────────────┘ │
│                     │ │                     │ │                     │
│ Status: COLLECTING  │ │ Status: STANDBY     │ │ Status: STANDBY     │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
           │                       │                       │
           └───────────────────────┼───────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Shared Resources                           │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   PostgreSQL    │  │      Redis      │  │   File System   │ │
│  │   (Articles)    │  │  (Locks/Cache)  │  │     (Logs)      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

Coordination Logic:
┌─────────────────────────────────────────────────────────────────┐
│  const lockKey = `collection:${schedule}:${timestamp}`;         │
│  const acquired = await redis.set(                             │
│    lockKey, nodeId, 'PX', 60000, 'NX'                         │
│  );                                                             │
│                                                                 │
│  if (acquired) {                                                │
│    // Only this node performs collection                       │
│    await this.performCollection(schedule);                     │
│  } else {                                                       │
│    // Other nodes wait for next cycle                          │
│    logger.info('Collection already in progress');              │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Визуальные элементы
- Схема кластера с нодами
- Статусы блокировок
- Код координации

---

## 🎨 Технические требования диаграмм

### Стиль и цвета
- **Успешные операции:** #22c55e (зеленый)
- **Ошибки:** #ef4444 (красный)
- **Предупреждения:** #f59e0b (оранжевый)
- **Информация:** #3b82f6 (синий)
- **Ожидание:** #6b7280 (серый)

### Форматы
- **Разрешение:** 1920x1080 для четкости
- **Формат:** SVG для масштабируемости
- **Шрифт:** Inter для текста, JetBrains Mono для кода
- **Анимации:** Pulse для активных процессов

### Инструменты создания
- **Miro** — для flow диаграмм
- **Figma** — для dashboard mockups
- **Draw.io** — для архитектурных схем
- **Grafana** — для реальных метрик

---

*Эти диаграммы покажут техническую глубину и надежность системы RSS сбора.*