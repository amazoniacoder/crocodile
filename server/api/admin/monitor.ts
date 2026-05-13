import { Router } from 'express';
import os from 'os';
import http from 'http';
import { asyncHandler } from '../../middleware/errorHandler';
import { noCache } from '../../middleware/cacheHeaders';
import { collectionStatRepository } from '../../infrastructure/persistence/CollectionStatRepository';
import { newsSourceRepository } from '../../infrastructure/persistence/NewsSourceRepository';
import { newsArticleRepository } from '../../infrastructure/persistence/NewsArticleRepository';

const router = Router();

// ─── Auth ─────────────────────────────────────────────────────────────────────

router.use(noCache);

// ─── GET /api/admin/monitor/stats ─────────────────────────────────────────────
// Агрегат за 24ч по каждому источнику + имя источника

router.get('/stats', asyncHandler(async (req, res) => {
  const hours = Math.min(parseInt(String(req.query.hours ?? '24')), 168);
  const [stats, sources] = await Promise.all([
    collectionStatRepository.aggregateLast24h(hours),
    newsSourceRepository.findAllActive(),
  ]);

  const sourceMap = new Map(sources.map(s => [s.id, s]));

  const result = stats.map(s => ({
    sourceId: s.sourceId,
    sourceName: s.sourceId ? (sourceMap.get(s.sourceId)?.name ?? `Source #${s.sourceId}`) : 'Unknown',
    region: s.sourceId ? (sourceMap.get(s.sourceId)?.region ?? null) : null,
    city: s.sourceId ? (sourceMap.get(s.sourceId)?.city ?? null) : null,
    isActive: s.sourceId ? (sourceMap.get(s.sourceId)?.isActive ?? null) : null,
    totalInserted: s.totalInserted ?? 0,
    totalDuplicate: s.totalDuplicate ?? 0,
    avgLatencyMs: s.avgLatencyMs ?? null,
    avgFetchDurationMs: s.avgFetchDurationMs ?? null,
    errorCount: s.errorCount ?? 0,
    lastCollectedAt: s.lastCollectedAt ?? null,
    lastError: s.lastError ?? null,
  }));

  // Добавляем источники без статистики за 24ч (не собирались или новые)
  const statsSourceIds = new Set(stats.map(s => s.sourceId));
  for (const source of sources) {
    if (!statsSourceIds.has(source.id)) {
      result.push({
        sourceId: source.id,
        sourceName: source.name,
        region: source.region,
        city: source.city ?? null,
        isActive: source.isActive ?? false,
        totalInserted: 0,
        totalDuplicate: 0,
        avgLatencyMs: null,
        avgFetchDurationMs: null,
        errorCount: 0,
        lastCollectedAt: source.lastFetchedAt ?? null,
        lastError: null,
      });
    }
  }

  result.sort((a, b) => (a.sourceName ?? '').localeCompare(b.sourceName ?? ''));
  res.json({ stats: result });
}));

// ─── GET /api/admin/monitor/chart ─────────────────────────────────────────────
// Данные для графика: статьи по источникам с разбивкой по часам

router.get('/chart', asyncHandler(async (req, res) => {
  const hours = Math.min(parseInt(String(req.query.hours ?? '24')), 168); // макс 7 дней
  const sourceId = req.query.sourceId ? parseInt(String(req.query.sourceId)) : undefined;

  const rows = await collectionStatRepository.chartByHour(hours);
  const sources = await newsSourceRepository.findAll();
  const sourceMap = new Map(sources.map(s => [s.id, s.name]));

  // Фильтр по источнику если передан
  const filtered = sourceId ? rows.filter(r => r.sourceId === sourceId) : rows;

  res.json({
    hours,
    data: filtered.map(r => ({
      sourceId: r.sourceId,
      sourceName: r.sourceId ? (sourceMap.get(r.sourceId) ?? `Source #${r.sourceId}`) : 'Unknown',
      hour: r.hour,
      articlesInserted: r.articlesInserted,
    })),
  });
}));

// ─── GET /api/admin/monitor/timing ────────────────────────────────────────────
// Последние N записей времени выполнения для LineChart

router.get('/timing', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? '50')), 200);
  const rows = await collectionStatRepository.recentCycleDurations(limit);
  res.json({ timing: rows });
}));

// ─── GET /api/admin/monitor/system ────────────────────────────────────────────
// Системные метрики: CPU, RAM, uptime, Node.js heap

router.get('/system', asyncHandler(async (_req, res) => {
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const loadAvg = os.loadavg();
  const cpus = os.cpus();

  const cpuUsage = cpus.map(cpu => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle = cpu.times.idle;
    return Math.round((1 - idle / total) * 100);
  });
  const avgCpuUsage = Math.round(cpuUsage.reduce((a, b) => a + b, 0) / cpuUsage.length);

  const collector = (global as any).collectNewsUseCase;
  collector?.refreshNextCycleAt?.();

  res.json({
    memory: {
      usedMb: Math.round((totalMem - freeMem) / 1024 / 1024),
      totalMb: Math.round(totalMem / 1024 / 1024),
      freeMb: Math.round(freeMem / 1024 / 1024),
      usedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
    },
    heap: {
      usedMb: Math.round(mem.heapUsed / 1024 / 1024),
      totalMb: Math.round(mem.heapTotal / 1024 / 1024),
      rssMb: Math.round(mem.rss / 1024 / 1024),
      usedPercent: Math.round((mem.heapUsed / mem.heapTotal) * 100),
    },
    cpu: {
      avgUsagePercent: avgCpuUsage,
      loadAvg1: Math.round(loadAvg[0] * 100) / 100,
      loadAvg5: Math.round(loadAvg[1] * 100) / 100,
      loadAvg15: Math.round(loadAvg[2] * 100) / 100,
      cores: cpus.length,
      model: cpus[0]?.model ?? 'Unknown',
    },
    uptime: {
      serverSec: Math.round(process.uptime()),
      osSec: Math.round(os.uptime()),
    },
    node: {
      version: process.version,
      platform: process.platform,
      tzOffset: new Date().getTimezoneOffset(),
    },
    collector: {
      lastCycleDurationMs: collector?.lastCycleDurationMs ?? null,
      lastCycleAt: collector?.lastCycleAt ?? null,
      cycleStartedAt: collector?.cycleStartedAt ?? null,
      isRunning: collector?.isRunning ?? false,
      nextCycleAt: collector?.nextCycleAt ?? null,
      nextFastCycleAt: collector?.nextFastCycleAt ?? null,
      nextSlowCycleAt: collector?.nextSlowCycleAt ?? null,
      currentSourceName: collector?.currentSourceName ?? null,
      currentSourceIndex: collector?.currentSourceIndex ?? null,
      totalSourcesInCycle: collector?.totalSourcesInCycle ?? 0,
    },
  });
}));

// ─── GET /api/admin/monitor/recent-articles ────────────────────────────────
// Статьи собранные за последние N часов

router.get('/recent-articles', asyncHandler(async (req, res) => {
  const hours = Math.min(parseInt(String(req.query.hours ?? '1')), 24);
  const limit = Math.min(parseInt(String(req.query.limit ?? '100')), 200);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const articles = await newsArticleRepository.findRecentlyFetched(since, limit);
  const sourceIds = [...new Set(articles.map((a: any) => a.sourceId).filter(Boolean))] as number[];
  const sourceMap = await newsArticleRepository.findSourceDisplay(sourceIds);

  res.json({
    articles: articles.map((a: any) => {
      const src = a.sourceId != null ? sourceMap.get(a.sourceId) : undefined;
      return {
        id: a.id,
        title: a.title,
        url: a.url,
        sourceName: src?.name ?? 'Unknown',
        sourceCity: src?.city ?? null,
        region: a.region,
        category: a.category,
        publishedAt: a.publishedAt,
        fetchedAt: a.fetchedAt,
      };
    }),
    hours,
  });
}));

// ─── GET /api/admin/monitor/rsshub ───────────────────────────────────────────
router.get('/rsshub', asyncHandler(async (_req, res) => {
  const online = await new Promise<boolean>(resolve => {
    const req = http.get('http://localhost:1200/healthz', { timeout: 2000 }, r => {
      resolve(r.statusCode !== undefined && r.statusCode < 500);
      r.resume();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
  res.json({ online });
}));

export default router;
