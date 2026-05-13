# Эпизод 8: "Мониторинг и алерты"

> **Длительность:** 20-25 минут
> **Цель:** Показать реальную систему observability — от Prometheus метрик до кабинета с 15 зонами
> **Аудитория:** Backend разработчики, DevOps, fullstack

---

## 🎯 Цели эпизода

- Разобрать Prometheus метрики — Counter, Histogram, Gauge, collectDefaultMetrics
- Показать HealthMonitoringService — Promise.allSettled, три статуса компонентов
- Объяснить SlaMonitor — p50/p95/p99, пороги, нарушения, Redis persistence
- Показать MonitoringIntegrationService — EventBus интеграция, graceful shutdown
- Провести тур по кабинету мониторинга — 15 зон, sidebar с tooltip

---

## 📝 Сценарий эпизода

### 🎬 Интро (2 минуты)

**[Открыть /admin/monitor в браузере]**

**Ведущий:**
> Привет! Восьмой эпизод — мониторинг и observability. Смотрите: кабинет с 15 зонами. Zone A — здоровье RSS-парсеров в реальном времени. Zone B — системные метрики: heap, CPU, uptime. Zone H — SLA: p95 latency, availability. Всё это работает на Prometheus, WebSocket и собственном AlertManager.

**[Показать структуру эпизода]**

> Разберём четыре слоя:
> - Prometheus метрики — что и как измеряем
> - HealthMonitoringService — health checks компонентов
> - SlaMonitor — latency percentiles и нарушения SLA
> - Кабинет мониторинга — 15 зон, polling, WebSocket

---

### 📊 Блок 1: Prometheus метрики (5 минут)

#### Подблок 1.1: Три типа метрик

**[Открыть server/infrastructure/monitoring/PrometheusMetrics.ts]**

**Ведущий:**
> Prometheus — стандарт де-факто для метрик. Три типа: Counter (только растёт), Histogram (распределение), Gauge (текущее значение).

```typescript
// server/infrastructure/monitoring/PrometheusMetrics.ts
import { Counter, Histogram, Gauge, register, collectDefaultMetrics } from 'prom-client';

// Стандартные метрики Node.js — heap, CPU, event loop lag
collectDefaultMetrics({ prefix: 'nodejs_' });

// Counter — только растёт, никогда не уменьшается
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
});

export const rssArticlesCollected = new Counter({
  name: 'rss_articles_collected_total',
  help: 'Total number of articles collected from RSS',
  labelNames: ['source', 'region', 'category'],
});

export const alertsTriggered = new Counter({
  name: 'alerts_triggered_total',
  help: 'Total number of alerts triggered',
  labelNames: ['rule_id', 'severity'],
});

// Histogram — распределение значений по bucket'ам
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10], // секунды
});

export const rssCollectionDuration = new Histogram({
  name: 'rss_collection_duration_seconds',
  help: 'RSS collection cycle duration in seconds',
  buckets: [10, 30, 60, 120, 300, 600],
});

// Gauge — текущее значение, может расти и падать
export const cacheSize = new Gauge({
  name: 'cache_size_bytes',
  help: 'Current cache size in bytes',
  labelNames: ['cache_type'],
});

export const rssCollectionLastSuccess = new Gauge({
  name: 'rss_collection_last_success_timestamp_seconds',
  help: 'Timestamp of last successful RSS collection',
});

// Экспорт registry → GET /metrics
export { register };
```

**Ведущий:**
> `collectDefaultMetrics` — одна строка, и мы получаем 30+ метрик Node.js бесплатно: heap used/total, GC duration, event loop lag. `labelNames` — это как GROUP BY в SQL, позволяет фильтровать по source, region, category.

#### Подблок 1.2: Использование метрик в коде

```typescript
// Где используются метрики:

// 1. HTTP middleware — каждый запрос
httpRequestsTotal.inc({ method: req.method, path: req.path, status: res.statusCode });
const end = httpRequestDuration.startTimer({ method: req.method, path: req.path });
// ... обработка ...
end(); // записывает duration в histogram

// 2. RSS сбор — после каждой статьи
rssArticlesCollected.inc({ source: sourceName, region, category });

// 3. AlertManager — при срабатывании правила
alertsTriggered.inc({ rule_id: rule.id, severity: rule.severity });

// 4. Кэш — при hit/miss
cacheHits.inc({ cache_type: 'redis' });
cacheMisses.inc({ cache_type: 'memory' });

// Endpoint для Prometheus scraping:
// GET /metrics → register.metrics() → text/plain
```

---

### 🏥 Блок 2: HealthMonitoringService (5 минут)

#### Подблок 2.1: Promise.allSettled — параллельные проверки

**[Открыть server/infrastructure/monitoring/HealthMonitoringService.ts]**

```typescript
// server/infrastructure/monitoring/HealthMonitoringService.ts

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
    ner: ComponentHealth;
    gracefulNer: ComponentHealth;
  };
  timestamp: Date;
  uptime: number;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'critical' | 'unavailable';
  responseTime?: number;
  error?: string;
  details?: Record<string, any>;
}

async checkSystemHealth(): Promise<SystemHealth> {
  // Promise.allSettled — все проверки параллельно
  // Одна упавшая не блокирует остальные
  const [database, redis, ner, gracefulNer] = await Promise.allSettled([
    this.checkDatabase(5000),
    this.checkRedis(5000),
    this.checkNerService(5000),
    this.checkGracefulNer(5000),
  ]);

  return {
    overall: this.calculateOverallHealth([...]),
    components: {
      database: this.getResultValue(database),
      redis: this.getResultValue(redis),
      ner: this.getResultValue(ner),
      gracefulNer: this.getResultValue(gracefulNer),
    },
    timestamp: new Date(),
    uptime: Date.now() - this.startTime,
  };
}
```

**Ведущий:**
> `Promise.allSettled` вместо `Promise.all` — ключевое решение. Если Redis упал, мы всё равно получим статус БД и NER. `Promise.all` бросил бы исключение при первой ошибке.

#### Подблок 2.2: Три уровня статуса

```typescript
// Проверка БД — responseTime > 1000ms → degraded
private async checkDatabase(timeout: number): Promise<ComponentHealth> {
  const startTime = Date.now();
  try {
    await Promise.race([
      db.execute('SELECT 1 as health'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout))
    ]);
    const responseTime = Date.now() - startTime;
    const connectionCount = await this.getDatabaseConnectionCount();
    return {
      status: responseTime > 1000 ? 'degraded' : 'healthy',
      responseTime,
      details: { connectionCount, maxConnections: 100 },
    };
  } catch (error) {
    return { status: 'critical', responseTime: Date.now() - startTime, error: error.message };
  }
}

// Проверка Redis — responseTime > 500ms → degraded
private async checkRedis(timeout: number): Promise<ComponentHealth> {
  const redis = await getRedisClient();
  if (!redis) return { status: 'unavailable', error: 'Redis not configured' };
  // ping + info memory → { used, peak }
}

// Проверка NER — successRate < 80% → degraded
private async checkNerService(timeout: number): Promise<ComponentHealth> {
  const result = await nerService.healthCheck();
  const metrics = nerService.getMetrics();
  const successRate = metrics.successfulRequests / Math.max(1, metrics.totalRequests);
  return {
    status: !result.available ? 'unavailable' : successRate < 0.8 ? 'degraded' : 'healthy',
    details: { circuitBreakerState: metrics.circuitBreakerState, successRate },
  };
}

// Общий статус: любой critical → critical, любой degraded → degraded
private calculateOverallHealth(components: ComponentHealth[]): SystemHealth['overall'] {
  if (components.some(c => c.status === 'critical')) return 'critical';
  if (components.some(c => c.status === 'degraded')) return 'degraded';
  return 'healthy';
}
```

---

### 📈 Блок 3: SlaMonitor (5 минут)

#### Подблок 3.1: Percentiles — p50, p95, p99

**[Открыть server/infrastructure/monitoring/SlaMonitor.ts]**

**Ведущий:**
> SLA — Service Level Agreement. Мы обещаем что 95% запросов к `/api/news` ответят быстрее 500ms. Это p95. Среднее значение врёт — один медленный запрос не виден. Percentiles честны.

```typescript
// server/infrastructure/monitoring/SlaMonitor.ts

// Пороги по умолчанию
private readonly DEFAULT_THRESHOLDS: SlaThreshold[] = [
  { endpoint: '/api/news',        maxResponseTimeMs: 500,  maxErrorRate: 0.05, minAvailability: 0.99 },
  { endpoint: '/api/news/search', maxResponseTimeMs: 1000, maxErrorRate: 0.05, minAvailability: 0.98 },
  { endpoint: '/api/admin/*',     maxResponseTimeMs: 2000, maxErrorRate: 0.02, minAvailability: 0.99 },
  { endpoint: '/api/health',      maxResponseTimeMs: 200,  maxErrorRate: 0.01, minAvailability: 0.999 },
];

// Вычисление percentile из отсортированного массива
private calculatePercentile(sortedArray: number[], percentile: number): number {
  const index = Math.ceil(sortedArray.length * percentile) - 1;
  return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
}

// Метрики для endpoint'а
private calculateSlaMetrics(endpoint: string, method: string): SlaMetrics {
  const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b);
  return {
    averageResponseTime: Math.round(responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length),
    p50: this.calculatePercentile(responseTimes, 0.5),  // медиана
    p95: this.calculatePercentile(responseTimes, 0.95), // 95% запросов быстрее этого
    p99: this.calculatePercentile(responseTimes, 0.99), // 99% запросов быстрее этого
    errorRate: Math.round(errorRequests / totalRequests * 10000) / 100, // %
    availability: Math.round(successfulRequests / totalRequests * 10000) / 100, // %
    throughput: recentMetrics.length / 60, // req/min за последний час
  };
}
```

#### Подблок 3.2: Middleware и Redis persistence

```typescript
// Express middleware — перехватывает res.send
middleware() {
  return (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;

    res.send = function(body) {
      res.send = originalSend; // восстанавливаем немедленно
      const responseTime = Date.now() - startTime;

      // setImmediate — не блокируем ответ клиенту
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

// Redis: скользящее окно последних 1000 метрик на endpoint
await redis.lPush(`sla:metrics:${key}`, JSON.stringify(data));
await redis.lTrim(`sla:metrics:${key}`, 0, 999);
await redis.expire(`sla:metrics:${key}`, 24 * 60 * 60); // 24ч TTL

// Нарушения SLA — проверка каждые 5 минут
// p95 > maxResponseTimeMs → violation 'response_time'
// errorRate > maxErrorRate → violation 'error_rate'
// availability < minAvailability → violation 'availability'
// Redis: sla:violation:<id>, TTL 7 дней
```

---

### 🖥️ Блок 4: Кабинет мониторинга (5 минут)

#### Подблок 4.1: MonitoringIntegrationService — связующее звено

**[Открыть server/infrastructure/monitoring/MonitoringIntegrationService.ts]**

```typescript
// server/infrastructure/monitoring/MonitoringIntegrationService.ts

async initialize(): Promise<void> {
  // 1. AlertManager запускается автоматически при создании
  await this.initializeAlerting();

  // 2. EventBus интеграция — инвалидация кэша
  eventBus.on('articles.collected', async () => {
    await queryCacheService.invalidateByTags(['news']);
  });
  eventBus.on('cluster.updated', async () => {
    await queryCacheService.invalidateByTags(['news', 'clusters']);
  });
  eventBus.on('source.updated', async () => {
    await queryCacheService.invalidateByTags(['sources', 'news']);
  });
  eventBus.on('reaction.updated', async () => {
    await queryCacheService.invalidateByTags(['popular', 'reactions']);
  });

  // 3. Graceful shutdown
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

// Диагностика системы
async runDiagnostics() {
  const health = await healthMonitoringService.checkSystemHealth();
  const alertStats = await alertManager.getAlertStats();
  const cacheStats = queryCacheService.getStats();

  // Рекомендации:
  if (alertStats.activeAlerts > 5)
    recommendations.push(`High number of active alerts (${alertStats.activeAlerts})`);
  if (cacheStats.hitRate < 0.5)
    recommendations.push(`Low cache hit rate (${Math.round(cacheStats.hitRate * 100)}%)`);

  return { overall, components, recommendations };
}
```

#### Подблок 4.2: 15 зон кабинета

**[Открыть /admin/monitor в браузере, показать sidebar]**

**[Открыть client/src/components/admin/monitor/MonitorLayout.tsx]**

```
Sidebar — 15 зон (иконка + label + desc):

Zone A  Мониторинг    Parser Health
  ├─ OverviewStats: статьи за 1ч, цикл сбора, следующий запуск
  ├─ RegionPieChart: Россия vs Мир (Recharts PieChart)
  ├─ ActivityChart: активность за 24ч (Recharts LineChart)
  ├─ SourceHealthTable: здоровье каждого источника
  └─ Polling: 30 сек (данные) + 2 сек (статус коллектора)

Zone B  Система       Infrastructure
  ├─ SystemMetrics: heap RSS/used/total, CPU loadAvg, uptime
  ├─ RunningTimer: живой таймер текущего цикла сбора
  ├─ CollectionTimingChart: история длительности циклов
  └─ Web Push stats: подписки, VAPID статус, порог

Zone C  Управление    Control Room
  ├─ ManualCollect: запустить сбор вручную
  ├─ SourceForm: добавить/редактировать источник
  ├─ SourcesTable: список всех источников
  └─ IntervalConfig: настройка расписания fast/slow

Zone D  Аналитика     Visits & Clicks
  ├─ AnalyticsSummaryCards, DailyChart, HourlyChart
  ├─ TopArticlesTable, TopSourcesTable, TopPagesTable
  └─ WorldMapTable, TopCitiesTable, DevicesChart

Zone E  Сущности      Hot Entities (NER за 24ч)
Zone F  Кластер       Cluster Health
Zone G  Тесты         Cluster Tests
Zone H  SLA           Performance (p50/p95/p99)
Zone I  Токены        Token Management
Zone J  API-ключи     Public API Keys
Zone K  Погода        Weather Cities
Zone L  Telegram      TG Integration
Zone M  YouTube       YT Integration
Zone N  User Tokens   Personal Feed
Zone O  Админ         Private Channels
```

#### Подблок 4.3: Zone A — WebSocket + двойной polling

**[Открыть client/src/components/admin/monitor/ZoneA/ZoneA.tsx]**

```typescript
// Zone A — два интервала polling

// Основной: данные каждые 30 сек
useEffect(() => {
  fetchAll(); // stats 24ч + stats 1ч + chart + system
  const id = setInterval(fetchAll, 30_000);
  return () => clearInterval(id);
}, [fetchAll]);

// Быстрый: статус коллектора каждые 2 сек
// Нужен для живого отображения "▶ выполняется... 45 с"
useEffect(() => {
  const id = setInterval(fetchSystem, 2_000);
  return () => clearInterval(id);
}, [fetchSystem]);

// WebSocket: мгновенное обновление при новых статьях
useEffect(() => {
  socket.subscribe('news_updated', fetchAll);
  return () => socket.unsubscribe('news_updated', fetchAll);
}, [socket, fetchAll]);

// Аномальные источники — badge в заголовке
const anomalous = stats.filter(s => s.isActive && (s.errorCount > 0 || s.totalInserted === 0)).length;
// → "3 аномальных" красный badge
```

#### Подблок 4.4: Zone B — живой таймер цикла

**[Открыть client/src/components/admin/monitor/ZoneB/SystemMetrics.tsx]**

```typescript
// RunningTimer — тикает каждую секунду пока цикл активен
function RunningTimer({ startedAt }: { startedAt: string | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const base = startedAt ? Date.now() - new Date(startedAt).getTime() : 0;
    setElapsed(Math.floor(base / 1000));
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return <span>{elapsed} с</span>;
}

// ProgressBar — цвет зависит от процента
// pct >= 90 → error (красный)
// pct >= 70 → warn (жёлтый)
// иначе    → нормальный (зелёный)
function ProgressBar({ pct }: { pct: number }) {
  const cls = pct >= 90 ? '--error' : pct >= 70 ? '--warn' : '';
  return <div className={`monitor-progress__bar ${cls}`} style={{ width: `${pct}%` }} />;
}

// Sidebar tooltip — через createPortal
// Появляется справа от sidebar при hover на зону
// Throttle через requestAnimationFrame
```

---

### 🎓 Заключение (1 минута)

**Ведущий:**
> Итоги системы мониторинга:

1. **Prometheus** — Counter/Histogram/Gauge + collectDefaultMetrics, `/metrics` endpoint
2. **HealthMonitoringService** — Promise.allSettled, 4 компонента, три статуса
3. **SlaMonitor** — p50/p95/p99, 4 пороговых правила, Redis persistence
4. **MonitoringIntegrationService** — EventBus, graceful shutdown, диагностика
5. **Кабинет** — 15 зон, двойной polling (30с + 2с), WebSocket, живые таймеры

> В следующем эпизоде — база данных и производительность: PostgreSQL оптимизация, GIN-индексы, двухуровневый кэш Redis → in-memory.

---

## 🎥 Технические требования

### Файлы для демонстрации
```
server/infrastructure/monitoring/
├── PrometheusMetrics.ts              ← Блок 1: Counter, Histogram, Gauge
├── HealthMonitoringService.ts        ← Блок 2: Promise.allSettled, три статуса
├── SlaMonitor.ts                     ← Блок 3: percentiles, пороги, нарушения
└── MonitoringIntegrationService.ts   ← Блок 4: EventBus, graceful shutdown

client/src/components/admin/monitor/
├── MonitorLayout.tsx                 ← Блок 4: 15 зон, sidebar, tooltip
├── ZoneA/ZoneA.tsx                   ← Блок 4: двойной polling, WebSocket
├── ZoneA/OverviewStats.tsx           ← Блок 4: статистика обзора
├── ZoneB/ZoneB.tsx                   ← Блок 4: системные метрики
└── ZoneB/SystemMetrics.tsx           ← Блок 4: RunningTimer, ProgressBar
```

### Демо в браузере
- Открыть `/admin/monitor` → показать sidebar с 15 зонами
- Zone A → показать OverviewStats + аномальные источники badge
- Zone A → показать двойной polling в DevTools → Network
- Zone B → показать SystemMetrics: heap, CPU, uptime, RunningTimer
- Zone B → показать ProgressBar цвета при разных значениях
- Терминал: `curl http://localhost:5000/metrics` → Prometheus формат
- Терминал: `curl http://localhost:5000/api/health` → SystemHealth JSON
