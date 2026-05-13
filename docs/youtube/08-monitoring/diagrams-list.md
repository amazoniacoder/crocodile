# Диаграммы для Эпизода 8: "Мониторинг и алерты"

---

## 📊 Диаграмма 1: Архитектура observability

```
Приложение (Node.js)
        │
        ├─ PrometheusMetrics.ts
        │    Counter / Histogram / Gauge
        │    collectDefaultMetrics (nodejs_*)
        │    → register.metrics() → GET /metrics
        │                               │
        │                               ▼
        │                        Prometheus Server
        │                        (scraping каждые 15с)
        │                               │
        │                               ▼
        │                           Grafana
        │                        (дашборды, алерты)
        │
        ├─ HealthMonitoringService.ts
        │    Promise.allSettled([DB, Redis, NER, GracefulNER])
        │    → SystemHealth { overall, components }
        │    → GET /api/health
        │
        ├─ SlaMonitor.ts
        │    middleware() → setImmediate → recordMetric
        │    checkSlaViolations() каждые 5 мин
        │    → Redis: sla:metrics:*, sla:violations
        │
        ├─ AlertManager.ts
        │    17 правил, каждые 30 сек
        │    → WebSocket / Webhook / Log
        │    → Redis: alert:*, alerts:history
        │
        └─ MonitoringIntegrationService.ts
             EventBus → cache invalidation
             SIGTERM/SIGINT → graceful shutdown
             → /admin/monitor (кабинет)
```

---

## 📊 Диаграмма 2: Prometheus — три типа метрик

```
Counter (только растёт):
  http_requests_total
  ┌────────────────────────────────────────────┐
  │ 0 → 1 → 2 → 3 → ... → 10000 → 10001 → ...│
  └────────────────────────────────────────────┘
  Запрос: rate(http_requests_total[5m])
  → запросов в секунду за последние 5 минут

Histogram (распределение):
  http_request_duration_seconds
  bucket[0.01]: 150  ← 150 запросов быстрее 10ms
  bucket[0.05]: 820  ← 820 запросов быстрее 50ms
  bucket[0.1]:  950  ← 950 запросов быстрее 100ms
  bucket[0.5]:  990  ← 990 запросов быстрее 500ms
  bucket[1.0]:  998
  bucket[+Inf]: 1000
  Запрос: histogram_quantile(0.95, rate(...[5m]))
  → p95 latency

Gauge (текущее значение):
  cache_size_bytes{cache_type="redis"}
  ┌────────────────────────────────────────────┐
  │ 1MB → 2MB → 1.5MB → 3MB → 2MB → ...       │
  └────────────────────────────────────────────┘
  Запрос: cache_size_bytes
  → текущий размер кэша
```

---

## 📊 Диаграмма 3: HealthMonitoringService — поток

```
GET /api/health
        │
        ▼
healthMonitoringService.checkSystemHealth()
        │
        ▼
healthCheckInProgress? → вернуть lastHealthCheck (кэш)
        │
        ▼
Promise.allSettled([
  checkDatabase(5000ms),    ─────────────────────┐
  checkRedis(5000ms),       ──────────────────┐  │
  checkNerService(5000ms),  ───────────────┐  │  │
  checkGracefulNer(5000ms)  ────────────┐  │  │  │
])                                      │  │  │  │
                                        ▼  ▼  ▼  ▼
                                    Параллельно!
                                    Одна ошибка не
                                    блокирует остальные
        │
        ▼
calculateOverallHealth(components):
  any critical? → 'critical'
  any degraded? → 'degraded'
  all healthy?  → 'healthy'
        │
        ▼
{
  overall: 'degraded',
  components: {
    database:    { status: 'healthy',     responseTime: 8 },
    redis:       { status: 'critical',    error: 'ECONNREFUSED' },
    ner:         { status: 'unavailable', details: { cbState: 'OPEN' } },
    gracefulNer: { status: 'degraded',    details: { fallback: 'simple' } }
  },
  uptime: 86400000
}
```

---

## 📊 Диаграмма 4: SlaMonitor — жизненный цикл метрики

```
HTTP запрос → Express middleware
        │
        ▼
slaMonitor.middleware()
  startTime = Date.now()
  override res.send
        │
        ▼
Обработка запроса (DB, cache, business logic)
        │
        ▼
res.send(body) вызван
  responseTime = Date.now() - startTime
  res.send = originalSend (восстановить!)
        │
        ├─ originalSend.call(this, body)
        │    → клиент получает ответ НЕМЕДЛЕННО
        │
        └─ setImmediate(() => recordMetric(...))
             → запись метрики ПОСЛЕ ответа
                     │
                     ▼
             in-memory Map<key, ResponseTimeMetric[]>
             max 1000 метрик на endpoint
                     │
                     ▼
             Redis lPush sla:metrics:<key>
             lTrim 0..999, expire 24ч
                     │
                     ▼ (каждые 5 минут)
             checkSlaViolations()
               calculateSlaMetrics() → p50/p95/p99
               p95 > threshold? → recordViolation()
               → Redis sla:violation:<id>, TTL 7 дней
```

---

## 📊 Диаграмма 5: Percentiles — визуализация

```
100 запросов к /api/news, отсортированные по времени:

Запрос #1:   12ms  ←─ p50 (медиана) = 45ms
Запрос #2:   15ms     50% запросов быстрее 45ms
...
Запрос #50:  45ms  ←─ p50
...
Запрос #95:  180ms ←─ p95
             ↑         95% запросов быстрее 180ms
             Порог SLA: 500ms → OK ✅
...
Запрос #99:  450ms ←─ p99
...
Запрос #100: 4800ms   1% запросов медленнее 450ms

Среднее: (sum всех) / 100 = 97ms
  → "всё хорошо" (врёт — скрывает медленные запросы)

p95 = 180ms < 500ms → SLA выполняется ✅
p99 = 450ms < 500ms → SLA выполняется ✅

Если бы p95 = 600ms > 500ms:
  → SlaViolation { violationType: 'response_time',
                   threshold: 500, actualValue: 600 }
  → Redis sla:violations
```

---

## 📊 Диаграмма 6: Кабинет — 15 зон

```
/admin/monitor
        │
        ▼
MonitorLayout
  ┌─────────────────────────────────────────────────────┐
  │ Sidebar (60px → 240px при hover, 300ms delay)       │
  │                                                     │
  │ [A] 📡 Мониторинг    Parser Health                  │
  │ [B] ⚙️  Система       Infrastructure                │
  │ [C] 🎛️  Управление    Control Room                  │
  │ [D] 📊 Аналитика     Visits & Clicks                │
  │ [E] 🔥 Сущности      Hot Entities                   │
  │ [F] 🖥️  Кластер       Cluster Health                │
  │ [G] 🧪 Тесты         Cluster Tests                  │
  │ [H] 📈 SLA           Performance                    │
  │ [I] 🛡️  Токены        Token Management              │
  │ [J] 🔑 API-ключи     Public API Keys                │
  │ [K] ☀️  Погода        Weather Cities                │
  │ [L] 📱 Telegram      TG Integration                 │
  │ [M] ▶️  YouTube       YT Integration                │
  │ [N] 👤 User Tokens   Personal Feed                  │
  │ [O] 🔒 Админ         Private Channels               │
  │                                                     │
  │ [→] Выйти                                           │
  └─────────────────────────────────────────────────────┘
  
  Tooltip (createPortal → document.body):
    "Zone A: Мониторинг"
    Позиция: справа от sidebar, по центру кнопки
    Throttle: requestAnimationFrame
```

---

## 📊 Диаграмма 7: Zone A — двойной polling

```
Zone A: Parser Health

Polling 1 (30 сек):
  Promise.all([
    adminApi.getStats(token, 24),  → stats за 24ч
    adminApi.getStats(token, 1),   → stats за 1ч
    adminApi.getChart(token, 24),  → chart данные
    adminApi.getSystem(token),     → system metrics
  ])
  → setStats, setStats1h, setChart, setSystem

Polling 2 (2 сек):
  adminApi.getSystem(token)
  → setSystem
  → collector.isRunning → RunningTimer тикает
  → collector.currentSourceIndex/totalSourcesInCycle

WebSocket (мгновенно):
  socket.subscribe('news_updated', fetchAll)
  → при новых статьях — немедленное обновление

RSSHub polling (30 сек):
  adminApi.getRssHub(token) → { online: boolean }
  → зелёная/красная точка в заголовке

Аномалии:
  stats.filter(s => s.isActive &&
    (s.errorCount > 0 || s.totalInserted === 0))
  → badge "N аномальных" в заголовке
```

---

*Диаграммы основаны на реальной реализации проекта.*
