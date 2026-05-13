# Слайды для Эпизода 8: "Мониторинг и алерты"

> **Презентация:** 22-24 слайда для 20-25 минут эпизода

---

### Слайд 1: Заставка
```
NewsAggregator — Observability
Эпизод 8: "Мониторинг и алерты"

📊 Prometheus: Counter + Histogram + Gauge
🏥 HealthMonitoringService: Promise.allSettled
📈 SlaMonitor: p50/p95/p99 + нарушения
🔗 MonitoringIntegrationService: EventBus
🖥️ Кабинет: 15 зон, двойной polling, WebSocket
```

### Слайд 2: Три столпа observability
```
Observability = Metrics + Logs + Traces

Metrics (Prometheus):
  Что происходит в системе?
  http_requests_total, rss_articles_collected_total
  → числа, агрегации, алерты

Logs (Winston):
  Почему это произошло?
  [WARN] RSS collection stalled for 35 minutes
  → контекст, детали, отладка

Traces (будущее):
  Где именно это произошло?
  request → middleware → DB query → cache
  → путь запроса через систему

В этом эпизоде: Metrics + интеграция с Logs
```

---

## Блок 1: Prometheus метрики (слайды 3-6)

### Слайд 3: Три типа метрик
```
Counter — только растёт
  http_requests_total{method="GET", path="/api/news", status="200"}
  rss_articles_collected_total{source="lenta", region="russia"}
  alerts_triggered_total{rule_id="ssl-expiring", severity="warning"}
  Зачем: rate(), increase() за период

Histogram — распределение по bucket'ам
  http_request_duration_seconds{method="GET", path="/api/news"}
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10] сек
  Зачем: histogram_quantile(0.95, ...) → p95 latency

Gauge — текущее значение
  cache_size_bytes{cache_type="redis"}
  rss_collection_last_success_timestamp_seconds
  Зачем: мгновенный снимок состояния
```

### Слайд 4: collectDefaultMetrics — бесплатные метрики
```typescript
// Одна строка → 30+ метрик Node.js
collectDefaultMetrics({ prefix: 'nodejs_' });

// Что получаем автоматически:
nodejs_heap_size_used_bytes      ← JS heap used
nodejs_heap_size_total_bytes     ← JS heap total
nodejs_external_memory_bytes     ← native memory
nodejs_gc_duration_seconds       ← GC паузы
nodejs_eventloop_lag_seconds     ← event loop lag
nodejs_active_handles_total      ← открытые handles
nodejs_active_requests_total     ← активные запросы
process_cpu_seconds_total        ← CPU time
process_resident_memory_bytes    ← RSS memory

// Endpoint для Prometheus scraping:
// GET /metrics → register.metrics() → text/plain
```

### Слайд 5: labelNames — GROUP BY для метрик
```typescript
// Без labels — одно число
httpRequestsTotal.inc(); // бесполезно

// С labels — можно фильтровать и агрегировать
httpRequestsTotal.inc({
  method: 'GET',
  path: '/api/news',
  status: '200'
});

// В Prometheus/Grafana:
// rate(http_requests_total{status="5xx"}[5m])
// → ошибки в секунду за последние 5 минут

// histogram_quantile(0.95,
//   rate(http_request_duration_seconds_bucket{path="/api/news"}[5m])
// )
// → p95 latency для /api/news за 5 минут
```

### Слайд 6: Метрики в коде — где используются
```
PrometheusMetrics.ts → экспортирует объекты метрик

Используются в:
  middleware/performanceMonitor.ts
    → httpRequestsTotal.inc()
    → httpRequestDuration.startTimer() / end()

  application/news/CollectNewsUseCase.ts
    → rssArticlesCollected.inc({ source, region, category })
    → rssCollectionDuration.observe(duration)
    → rssCollectionLastSuccess.setToCurrentTime()

  infrastructure/monitoring/AlertManager.ts
    → alertsTriggered.inc({ rule_id, severity })

  infrastructure/cache/
    → cacheHits.inc({ cache_type })
    → cacheMisses.inc({ cache_type })
    → cacheSize.set({ cache_type }, bytes)
```

---

## Блок 2: HealthMonitoringService (слайды 7-9)

### Слайд 7: Promise.allSettled — почему не Promise.all
```
Promise.all:
  [DB check, Redis check, NER check, GracefulNER check]
  Redis упал → Promise.all бросает исключение
  → не знаем статус DB и NER ❌

Promise.allSettled:
  [DB check, Redis check, NER check, GracefulNER check]
  Redis упал → { status: 'rejected', reason: Error }
  DB, NER → { status: 'fulfilled', value: ComponentHealth }
  → знаем статус ВСЕХ компонентов ✅

Результат:
  {
    overall: 'degraded',
    components: {
      database:   { status: 'healthy',     responseTime: 12 },
      redis:      { status: 'critical',    error: 'ECONNREFUSED' },
      ner:        { status: 'unavailable', details: { circuitBreakerState: 'OPEN' } },
      gracefulNer:{ status: 'degraded',    details: { fallbackStrategy: 'simple' } }
    }
  }
```

### Слайд 8: Три уровня статуса компонента
```
healthy:
  DB: responseTime < 1000ms + SELECT 1 успешен
  Redis: responseTime < 500ms + PING успешен
  NER: available=true + successRate >= 80%

degraded:
  DB: responseTime >= 1000ms (медленно, но работает)
  Redis: responseTime >= 500ms
  NER: available=true + successRate < 80%
  GracefulNER: nerAvailable=false + fallbackEnabled=true

critical:
  DB: исключение при SELECT 1
  Redis: исключение при PING

unavailable:
  Redis: не сконфигурирован (нет REDIS_URL)
  NER: available=false (Circuit Breaker OPEN)

Общий статус:
  любой critical → overall: 'critical'
  любой degraded → overall: 'degraded'
  все healthy    → overall: 'healthy'
```

### Слайд 9: Детали проверок
```typescript
// DB: дополнительно считаем активные соединения
SELECT count(*) FROM pg_stat_activity WHERE state = 'active'
→ details: { connectionCount: 5, maxConnections: 100 }

// Redis: парсим info memory
redis.info('memory')
→ details: { memoryUsage: { used: 2048000, peak: 3145728 } }

// NER: метрики Circuit Breaker
nerService.getMetrics()
→ details: {
    circuitBreakerState: 'CLOSED',
    totalRequests: 1250,
    successRate: 0.94,
    averageResponseTime: 187
  }

// GracefulNER: стратегия деградации
gracefulNerService.getStats()
→ details: {
    nerAvailable: false,
    fallbackEnabled: true,
    fallbackStrategy: 'simple',
    lastCheck: '2025-05-15T10:30:00Z'
  }
```

---

## Блок 3: SlaMonitor (слайды 10-13)

### Слайд 10: Почему percentiles, а не среднее
```
Пример: 100 запросов к /api/news
  98 запросов: 50ms
  2 запроса:   5000ms (медленные)

Среднее: (98×50 + 2×5000) / 100 = 149ms
  → "всё хорошо" ❌ (врёт)

p50 (медиана): 50ms
  → 50% запросов быстрее 50ms ✅

p95: 50ms
  → 95% запросов быстрее 50ms ✅

p99: 5000ms
  → 1% запросов медленнее 5 сек ⚠️

Вывод: p95 и p99 честно показывают
"хвост" распределения — именно там
живут проблемы производительности
```

### Слайд 11: Пороги SLA
```
Endpoint              p95 max   Error rate  Availability
──────────────────────────────────────────────────────────
/api/news             500ms     5%          99%
/api/news/search      1000ms    5%          98%
/api/admin/*          2000ms    2%          99%
/api/health           200ms     1%          99.9%

Нарушения (каждые 5 минут):
  p95 > maxResponseTimeMs → violation 'response_time'
  errorRate > maxErrorRate → violation 'error_rate'
  availability < minAvailability → violation 'availability'

Redis persistence:
  sla:violation:<id>  → hSet, TTL 7 дней
  sla:violations      → LIST последних 1000
  sla:metrics:<key>   → LIST последних 1000 метрик, TTL 24ч
```

### Слайд 12: SLA middleware — setImmediate
```typescript
middleware() {
  return (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;

    res.send = function(body) {
      res.send = originalSend; // восстанавливаем сразу!
      const responseTime = Date.now() - startTime;

      // setImmediate — запись метрики НЕ блокирует ответ
      // Клиент получает ответ, потом записываем метрику
      setImmediate(() => {
        slaMonitor.recordMetric({
          endpoint: req.route?.path || req.path,
          method: req.method,
          statusCode: res.statusCode,
          responseTime,
          timestamp: new Date(),
        });
      });

      return originalSend.call(this, body);
    };
    next();
  };
}

// Скользящее окно: последние 1000 метрик на endpoint
// Cleanup: каждый час удаляем метрики старше 24ч
```

### Слайд 13: SLA Summary
```typescript
async getSlaSummary() {
  return {
    totalEndpoints: 4,
    healthyEndpoints: 3,
    violatingEndpoints: 1,
    totalViolations: 12,
    activeViolations: 2,
    averageResponseTime: 145,    // ms
    overallAvailability: 99.87,  // %
    worstPerformingEndpoint: 'GET /api/news/search', // наибольший p95
  };
}
```

---

## Блок 4: Кабинет мониторинга (слайды 14-20)

### Слайд 14: MonitoringIntegrationService — связующее звено
```
initialize():
  1. AlertManager.start() — автоматически при создании
  2. EventBus интеграция:
     articles.collected → invalidateByTags(['news'])
     cluster.updated    → invalidateByTags(['news', 'clusters'])
     source.updated     → invalidateByTags(['sources', 'news'])
     reaction.updated   → invalidateByTags(['popular', 'reactions'])
  3. Graceful shutdown:
     SIGTERM / SIGINT → alertManager.stop() → process.exit(0)

getSystemStatus():
  → health (HealthMonitoringService)
  → alerting: { activeAlerts, rules: 17 }
  → cache: { available, stats: { hitRate, errors } }

runDiagnostics():
  → overall: healthy|degraded|critical
  → recommendations: string[]
  → "Low cache hit rate (43%). Consider adjusting TTL."
```

### Слайд 15: 15 зон кабинета
```
Zone A  Parser Health    — здоровье RSS-источников
Zone B  Infrastructure   — системные метрики
Zone C  Control Room     — управление источниками
Zone D  Visits & Clicks  — аналитика посещений
Zone E  Hot Entities     — NER сущности за 24ч
Zone F  Cluster Health   — состояние кластера
Zone G  Cluster Tests    — тестирование кластеризации
Zone H  Performance      — SLA метрики
Zone I  Token Management — токены администраторов
Zone J  Public API Keys  — API-ключи
Zone K  Weather Cities   — города погоды
Zone L  TG Integration   — Telegram каналы
Zone M  YT Integration   — YouTube каналы
Zone N  Personal Feed    — пользовательские токены
Zone O  Private Channels — приватные каналы

Sidebar: иконка + label + desc
  Hover → expand (300ms delay)
  Tooltip через createPortal (RAF throttle)
```

### Слайд 16: Zone A — двойной polling
```
Zone A: Parser Health

Данные (30 сек):
  adminApi.getStats(token, 24)  → stats за 24ч
  adminApi.getStats(token, 1)   → stats за 1ч
  adminApi.getChart(token, 24)  → chart данные
  adminApi.getSystem(token)     → system metrics

Статус коллектора (2 сек):
  adminApi.getSystem(token)
  → collector.isRunning
  → collector.cycleStartedAt
  → collector.currentSourceIndex / totalSourcesInCycle

WebSocket (мгновенно):
  socket.subscribe('news_updated', fetchAll)
  → при появлении новых статей — обновляем сразу

Аномалии:
  stats.filter(s => s.isActive && (s.errorCount > 0 || s.totalInserted === 0))
  → badge "3 аномальных" в заголовке зоны
```

### Слайд 17: Zone A — компоненты
```
Вкладки: Обзор | Россия | Мир | ⚠️ Ошибки | 🔒 Заблокированы

Обзор:
  OverviewStats
    ├─ статьи за 1ч, цикл сбора, следующий запуск
    ├─ fast cycle / slow cycle расписание
    └─ кнопки: "Последние статьи" / "Ошибки"
  RegionPieChart (Recharts PieChart)
    └─ Россия vs Мир
  ActivityChart (Recharts LineChart)
    └─ активность за 24ч

Ошибки / Заблокированы:
  ArticlesPerSourceChart (Recharts BarChart)
  SourceHealthTable
    └─ errorCount, totalInserted, lastError, lastSuccess

RSSHub badge:
  adminApi.getRssHub(token) → { online: boolean }
  → зелёная/красная точка в заголовке
```

### Слайд 18: Zone B — живые метрики
```typescript
// SystemMetrics — polling каждые 5 сек
{
  heap: { rssMb, usedMb, totalMb, usedPercent },
  cpu:  { loadAvg1, loadAvg5, loadAvg15, cores },
  uptime: { serverSec, osSec },
  node: { version },
  collector: {
    isRunning,
    cycleStartedAt,
    lastCycleAt,
    lastCycleDurationMs,
    nextFastCycleAt,
    nextSlowCycleAt,
    currentSourceIndex,
    totalSourcesInCycle,
    currentSourceName,
  }
}

// RunningTimer — тикает каждую секунду
// Показывает сколько секунд идёт текущий цикл сбора

// ProgressBar — три цвета:
// heap.usedPercent >= 90 → красный (error)
// heap.usedPercent >= 70 → жёлтый (warn)
// иначе                  → нормальный

// Web Push stats (60 сек):
// { enabled, subscriptions, threshold }
```

### Слайд 19: Sidebar — tooltip через createPortal
```typescript
// MonitorLayout.tsx

// Tooltip через createPortal — рендерится в document.body
// Избегает проблем с overflow: hidden в sidebar

{tooltip && createPortal(
  <div className="monitor__sidebar-tooltip"
    style={{ left: tooltip.x, top: tooltip.y }}
  >
    {tooltip.text}
  </div>,
  document.body
)}

// Throttle через requestAnimationFrame
// Предотвращает лишние ре-рендеры при быстром движении мыши
const handleSidebarMouseMove = (e) => {
  if (rafRef.current) return; // уже запланировано
  rafRef.current = requestAnimationFrame(() => {
    rafRef.current = null;
    // найти кнопку под курсором → обновить tooltip
  });
};

// Expand sidebar: 300ms delay при hover
// Предотвращает случайное раскрытие при проходе мышью
```

### Слайд 20: /api/health — публичный endpoint
```typescript
// GET /api/health → SystemHealth

{
  "overall": "healthy",
  "components": {
    "database":   { "status": "healthy",     "responseTime": 8 },
    "redis":      { "status": "healthy",     "responseTime": 2 },
    "ner":        { "status": "unavailable", "error": "Circuit breaker OPEN" },
    "gracefulNer":{ "status": "degraded",    "details": { "fallbackStrategy": "simple" } }
  },
  "timestamp": "2025-05-15T10:30:00.000Z",
  "uptime": 86400000
}

// HTTP статус:
// overall: 'healthy'  → 200
// overall: 'degraded' → 200 (работает, но не идеально)
// overall: 'critical' → 503 (Service Unavailable)

// Используется:
// → Kubernetes liveness/readiness probe
// → Uptime мониторинг (UptimeRobot, Pingdom)
// → security-monitor.sh (curl /api/health)
// → AlertManager (database-disconnected правило)
```

---

## Заключение (слайды 21-23)

### Слайд 21: Архитектура мониторинга
```
PrometheusMetrics.ts
  Counter: requests, articles, alerts, cache hits/misses
  Histogram: http duration, rss collection duration
  Gauge: cache size, last success timestamp
  collectDefaultMetrics: heap, CPU, GC, event loop
  → GET /metrics (Prometheus scraping)

HealthMonitoringService.ts
  Promise.allSettled([DB, Redis, NER, GracefulNER])
  → SystemHealth { overall, components, uptime }
  → GET /api/health

SlaMonitor.ts
  middleware() → setImmediate → recordMetric
  calculateSlaMetrics() → p50/p95/p99
  checkSlaViolations() каждые 5 мин
  Redis: metrics TTL 24ч, violations TTL 7 дней

MonitoringIntegrationService.ts
  AlertManager + EventBus + graceful shutdown
  runDiagnostics() → recommendations

Кабинет /admin/monitor
  15 зон, sidebar с tooltip (createPortal + RAF)
  Zone A: 30с + 2с polling + WebSocket
  Zone B: 5с polling, RunningTimer, ProgressBar
```

### Слайд 22: Ключевые решения
```
✅ Promise.allSettled вместо Promise.all
   → одна упавшая проверка не скрывает остальные

✅ setImmediate в SLA middleware
   → запись метрики не блокирует HTTP ответ

✅ Двойной polling в Zone A (30с + 2с)
   → данные обновляются редко, статус коллектора — часто

✅ createPortal для sidebar tooltip
   → избегаем overflow: hidden проблем

✅ requestAnimationFrame throttle
   → плавный UI без лишних ре-рендеров

✅ collectDefaultMetrics({ prefix: 'nodejs_' })
   → 30+ метрик Node.js бесплатно одной строкой
```

### Слайд 23: Анонс Эпизода 9
```
🎬 Эпизод 9: "База данных и производительность"

🗄️ PostgreSQL 17 — GIN-индексы, tsvector, триггеры
⚡ Drizzle ORM — типобезопасные запросы
🔴 Redis кэш — двухуровневый, тегированная инвалидация
📊 Query Cache — теги, TTL, hit rate
🔄 Архивирование — 14 дней → archive → delete

Подписывайтесь! 👍
```

---

## 🎨 Дизайн-система

- **Prometheus / метрики:** `#e6522c` (оранжево-красный, цвет Prometheus)
- **healthy:** `#22c55e` (зелёный)
- **degraded:** `#f59e0b` (янтарный)
- **critical:** `#ef4444` (красный)
- **unavailable:** `#6b7280` (серый)
- **SLA / percentiles:** `#6366f1` (индиго)
- **Кабинет / UI:** `#0ea5e9` (голубой)

---

*Слайды основаны на реальном production-коде проекта.*
