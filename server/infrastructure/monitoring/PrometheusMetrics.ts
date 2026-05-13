import { Counter, Histogram, Gauge, register, collectDefaultMetrics } from 'prom-client';

// Собирать стандартные метрики Node.js (heap, CPU, event loop)
collectDefaultMetrics({ prefix: 'nodejs_' });

// HTTP метрики
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status']
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});

// RSS сбор
export const rssArticlesCollected = new Counter({
  name: 'rss_articles_collected_total',
  help: 'Total number of articles collected from RSS',
  labelNames: ['source', 'region', 'category']
});

export const rssCollectionDuration = new Histogram({
  name: 'rss_collection_duration_seconds',
  help: 'RSS collection cycle duration in seconds',
  buckets: [10, 30, 60, 120, 300, 600]
});

export const rssCollectionErrors = new Counter({
  name: 'rss_collection_errors_total',
  help: 'Total number of RSS collection errors',
  labelNames: ['source', 'error_type']
});

export const rssCollectionLastSuccess = new Gauge({
  name: 'rss_collection_last_success_timestamp_seconds',
  help: 'Timestamp of last successful RSS collection'
});

// Кластеризация
export const newsClustersCreated = new Counter({
  name: 'news_clusters_created_total',
  help: 'Total number of news clusters created',
  labelNames: ['region', 'category']
});

// Кэш
export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type']
});

export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type']
});

export const cacheSize = new Gauge({
  name: 'cache_size_bytes',
  help: 'Current cache size in bytes',
  labelNames: ['cache_type']
});

// Алерты
export const alertsTriggered = new Counter({
  name: 'alerts_triggered_total',
  help: 'Total number of alerts triggered',
  labelNames: ['rule_id', 'severity']
});

// Экспорт registry для /metrics endpoint
export { register };
