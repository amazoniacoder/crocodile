# Примеры кода для Эпизода 8: "Мониторинг и алерты"

> Все примеры взяты из реального кода проекта

---

## 📊 PrometheusMetrics.ts — все метрики

```typescript
// server/infrastructure/monitoring/PrometheusMetrics.ts
import { Counter, Histogram, Gauge, register, collectDefaultMetrics } from 'prom-client';

// Стандартные метрики Node.js — heap, CPU, GC, event loop
collectDefaultMetrics({ prefix: 'nodejs_' });

// HTTP
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
});
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
});

// RSS сбор
export const rssArticlesCollected = new Counter({
  name: 'rss_articles_collected_total',
  labelNames: ['source', 'region', 'category'],
});
export const rssCollectionDuration = new Histogram({
  name: 'rss_collection_duration_seconds',
  buckets: [10, 30, 60, 120, 300, 600],
});
export const rssCollectionErrors = new Counter({
  name: 'rss_collection_errors_total',
  labelNames: ['source', 'error_type'],
});
export const rssCollectionLastSuccess = new Gauge({
  name: 'rss_collection_last_success_timestamp_seconds',
});

// Кластеризация
export const newsClustersCreated = new Counter({
  name: 'news_clusters_created_total',
  labelNames: ['region', 'category'],
});

// Кэш
export const cacheHits   = new Counter({ name: 'cache_hits_total',   labelNames: ['cache_type'] });
export const cacheMisses = new Counter({ name: 'cache_misses_total', labelNames: ['cache_type'] });
export const cacheSize   = new Gauge({   name: 'cache_size_bytes',   labelNames: ['cache_type'] });

// Алерты
export const alertsTriggered = new Counter({
  name: 'alerts_triggered_total',
  labelNames: ['rule_id', 'severity'],
});

// Экспорт registry → GET /metrics
export { register };
```

---

## 🏥 HealthMonitoringService.ts — ключевые методы

```typescript
// server/infrastructure/monitoring/HealthMonitoringService.ts

async checkSystemHealth(): Promise<SystemHealth> {
  if (this.healthCheckInProgress) {
    return this.lastHealthCheck || this.getEmptyHealth();
  }
  this.healthCheckInProgress = true;

  try {
    // Promise.allSettled — все параллельно, одна ошибка не блокирует
    const [database, redis, ner, gracefulNer] = await Promise.allSettled([
      this.checkDatabase(5000),
      this.checkRedis(5000),
      this.checkNerService(5000),
      this.checkGracefulNer(5000),
    ]);

    const health: SystemHealth = {
      overall: this.calculateOverallHealth([
        this.getResultValue(database),
        this.getResultValue(redis),
        this.getResultValue(ner),
        this.getResultValue(gracefulNer),
      ]),
      components: {
        database:    this.getResultValue(database),
        redis:       this.getResultValue(redis),
        ner:         this.getResultValue(ner),
        gracefulNer: this.getResultValue(gracefulNer),
      },
      timestamp: new Date(),
      uptime: Date.now() - this.startTime,
    };

    this.lastHealthCheck = health;
    return health;
  } finally {
    this.healthCheckInProgress = false;
  }
}

// DB: SELECT 1 + timeout race + connectionCount
private async checkDatabase(timeout: number): Promise<ComponentHealth> {
  const startTime = Date.now();
  try {
    await Promise.race([
      db.execute('SELECT 1 as health'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout)),
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

// Общий статус: critical > degraded > healthy
private calculateOverallHealth(components: ComponentHealth[]): SystemHealth['overall'] {
  if (components.some(c => c.status === 'critical')) return 'critical';
  if (components.some(c => c.status === 'degraded')) return 'degraded';
  return 'healthy';
}

// getResultValue — безопасное извлечение из Promise.allSettled
private getResultValue<T>(result: PromiseSettledResult<T>): T {
  if (result.status === 'fulfilled') return result.value;
  return { status: 'critical', error: result.reason?.message || 'Unknown error' } as T;
}
```

---

## 📈 SlaMonitor.ts — middleware и percentiles

```typescript
// server/infrastructure/monitoring/SlaMonitor.ts

// Express middleware — перехватывает res.send
middleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalSend = res.send;

    res.send = function(body: any) {
      res.send = originalSend; // восстанавливаем немедленно!
      const responseTime = Date.now() - startTime;

      // setImmediate — не блокируем HTTP ответ
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

// Вычисление percentile
private calculatePercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil(sortedArray.length * percentile) - 1;
  return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
}

// Метрики endpoint'а
private calculateSlaMetrics(endpoint: string, method: string): SlaMetrics {
  const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b);
  const recentMetrics = metrics.filter(m => m.timestamp > oneHourAgo);

  return {
    p50: this.calculatePercentile(responseTimes, 0.5),
    p95: this.calculatePercentile(responseTimes, 0.95),
    p99: this.calculatePercentile(responseTimes, 0.99),
    averageResponseTime: Math.round(responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length),
    errorRate: Math.round(errorRequests / totalRequests * 10000) / 100,
    availability: Math.round(successfulRequests / totalRequests * 10000) / 100,
    throughput: recentMetrics.length / 60, // req/min
  };
}

// Пороги по умолчанию
private readonly DEFAULT_THRESHOLDS = [
  { endpoint: '/api/news',        maxResponseTimeMs: 500,  maxErrorRate: 0.05, minAvailability: 0.99 },
  { endpoint: '/api/news/search', maxResponseTimeMs: 1000, maxErrorRate: 0.05, minAvailability: 0.98 },
  { endpoint: '/api/admin/*',     maxResponseTimeMs: 2000, maxErrorRate: 0.02, minAvailability: 0.99 },
  { endpoint: '/api/health',      maxResponseTimeMs: 200,  maxErrorRate: 0.01, minAvailability: 0.999 },
];
```

---

## 🔗 MonitoringIntegrationService.ts — EventBus интеграция

```typescript
// server/infrastructure/monitoring/MonitoringIntegrationService.ts

async initialize(): Promise<void> {
  // EventBus → инвалидация кэша
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

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    alertManager.stop();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

// Диагностика с рекомендациями
async runDiagnostics() {
  const alertStats = await alertManager.getAlertStats();
  const cacheStats = queryCacheService.getStats();
  const recommendations: string[] = [];

  if (alertStats.activeAlerts > 5)
    recommendations.push(`High number of active alerts (${alertStats.activeAlerts}). Review system health.`);
  if (cacheStats.hitRate < 0.5)
    recommendations.push(`Low cache hit rate (${Math.round(cacheStats.hitRate * 100)}%). Consider adjusting TTL.`);
  if (cacheStats.errors > cacheStats.totalRequests * 0.1)
    recommendations.push('High cache error rate. Check Redis connectivity.');

  return { overall, components, recommendations };
}
```

---

## 🖥️ ZoneA.tsx — двойной polling + WebSocket

```typescript
// client/src/components/admin/monitor/ZoneA/ZoneA.tsx

// Основной polling — данные каждые 30 сек
useEffect(() => {
  fetchAll(); // stats 24ч + stats 1ч + chart + system
  const id = setInterval(fetchAll, 30_000);
  return () => clearInterval(id);
}, [fetchAll]);

// Быстрый polling — статус коллектора каждые 2 сек
useEffect(() => {
  const id = setInterval(fetchSystem, 2_000);
  return () => clearInterval(id);
}, [fetchSystem]);

// WebSocket — мгновенное обновление при новых статьях
useEffect(() => {
  socket.subscribe('news_updated', fetchAll);
  return () => socket.unsubscribe('news_updated', fetchAll);
}, [socket, fetchAll]);

// Аномальные источники
const anomalous = stats.filter(
  s => s.isActive && (s.errorCount > 0 || s.totalInserted === 0)
).length;
// → badge "3 аномальных" в заголовке

// Заблокированные источники
const BLOCKED_MARKERS = ['Заблокировано', '503', 'Status code 503'];
const blockedSources = stats.filter(s =>
  BLOCKED_MARKERS.some(m => s.lastError?.includes(m))
);
```

---

## 🖥️ SystemMetrics.tsx — RunningTimer + ProgressBar

```typescript
// client/src/components/admin/monitor/ZoneB/SystemMetrics.tsx

// Живой таймер — тикает каждую секунду
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

// ProgressBar — три цвета по порогам
function ProgressBar({ pct }: { pct: number }) {
  const cls = pct >= 90 ? 'monitor-progress__bar--error'
            : pct >= 70 ? 'monitor-progress__bar--warn'
            : '';
  return (
    <div className="monitor-progress">
      <div className={`monitor-progress__bar ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// Форматирование uptime
function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}д ${h}ч ${m}м`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}
```

---

## 🖥️ MonitorLayout.tsx — sidebar tooltip

```typescript
// client/src/components/admin/monitor/MonitorLayout.tsx

// Tooltip через createPortal — рендерится в document.body
// Избегает overflow: hidden проблем в sidebar
{tooltip && createPortal(
  <div className="monitor__sidebar-tooltip"
    style={{ left: tooltip.x, top: tooltip.y }}
  >
    {tooltip.text}
  </div>,
  document.body
)}

// Throttle через requestAnimationFrame
const handleSidebarMouseMove = (e: React.MouseEvent<HTMLElement>) => {
  if (rafRef.current) return; // уже запланировано

  rafRef.current = requestAnimationFrame(() => {
    rafRef.current = null;
    const button = (e.target as HTMLElement).closest('button[data-zone]');
    if (!button) { setTooltip(null); return; }

    const zoneId = button.getAttribute('data-zone');
    const zoneData = ZONES.find(z => z.id === zoneId);
    const rect = button.getBoundingClientRect();
    const sidebarWidth = sidebarExpanded ? 240 : 60;

    setTooltip({
      text: `Zone ${zoneId}: ${zoneData.label}`,
      x: sidebarWidth + 10,
      y: rect.top + rect.height / 2,
    });
  });
};

// Expand sidebar: 300ms delay при hover
const handleSidebarMouseEnter = () => {
  expandTimeoutRef.current = setTimeout(() => {
    setSidebarExpanded(true);
  }, 300);
};
```

---

*Все примеры соответствуют реальному production-коду проекта.*
