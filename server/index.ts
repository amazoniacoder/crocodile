import express from 'express';
import { corsMiddleware, rateLimiter, sanitizeInput, securityHeadersMiddleware } from './middleware/security';
import { comprehensiveSecurityMiddleware, apiSecurityHeaders } from './middleware/enhancedSecurity';
import { ddosProtection } from './middleware/ddosProtection';
import { logger } from './utils/logger';
import { requestLogger } from './middleware/requestLogger';
import { healthMonitor } from './utils/healthMonitor';
import { compressionMiddleware } from './middleware/compression';
import { performanceMonitor } from './middleware/performanceMonitor';
import { requestIdMiddleware } from './middleware/requestId';
import { slaMonitor } from './infrastructure/monitoring/SlaMonitor';
import { registerRoutes } from './routes';
import { serveStatic, log } from './vite';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { clearPort } from './utils';
import { checkDatabaseConnection } from './db/db';
import { checkRedisConnection } from './db/redis';
import path from 'path';
import http from 'http';
import https from 'https';
import fs from 'fs';
import expressWs from 'express-ws';
import { WebSocket } from 'ws';
import * as nodeCron from 'node-cron';

const app = express();

// Trust Nginx reverse proxy
app.set('trust proxy', 1);

// Комплексная безопасность
app.use(comprehensiveSecurityMiddleware);
app.use(compressionMiddleware);
app.use(ddosProtection.middleware());
app.use(ddosProtection.createRateLimiter('normal'));
app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(slaMonitor.middleware());
app.use(performanceMonitor);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Дополнительная безопасность для API
app.use('/api', apiSecurityHeaders);

app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  },
}));

app.use(express.static(path.join(process.cwd(), 'public'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  },
}));

app.use((req, res, next) => {
  const start = Date.now();
  const p = req.path;
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (p.startsWith('/api')) log(`${req.method} ${p} ${res.statusCode} in ${duration}ms`);
  });
  next();
});

(async () => {
  // Initialize token management system
  const { tokenManager } = await import('./infrastructure/auth/TokenManager');
  await tokenManager.initialize();
  
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    logger.error('Failed to connect to database.');
    process.exit(1);
  }

  const redisConnected = await checkRedisConnection();
  if (redisConnected) {
    logger.info('Redis connected - caching enabled');
  } else {
    logger.warn('Redis unavailable - using in-memory fallback');
  }

  // Initialize Web Push
  const { webPushService } = await import('./infrastructure/push/WebPushService');
  webPushService.initialize();

  // Initialize monitoring systems
  const { monitoringIntegrationService } = await import('./infrastructure/monitoring/MonitoringIntegrationService');
  await monitoringIntegrationService.initialize();
  
  // Domain event subscribers
  const { clusterNewsUseCase } = await import('./application/news/ClusterNewsUseCase');
  const { initCacheSubscriber, initWebSocketSubscriber } = await import('./application/news/subscribers');
  clusterNewsUseCase.initialize();
  initCacheSubscriber();
  initWebSocketSubscriber();

  // News collector
  const { collectNewsUseCase } = await import('./application/news/CollectNewsUseCase');
  await collectNewsUseCase.initialize();
  // Экспортируем для использования в /api/admin/config
  (global as any).collectNewsUseCase = collectNewsUseCase;

  // Hot entities job
  const { startHotEntitiesJob } = await import('./application/news/HotEntitiesJob');
  startHotEntitiesJob();

  // Weather collection job
  const { startWeatherCollectionJob } = await import('./application/weather/WeatherCollectionService');
  startWeatherCollectionJob();

  // Initialize cluster components
  const { healthCheckManager } = await import('./infrastructure/cluster/HealthCheckManager');
  const { failoverController } = await import('./infrastructure/cluster/FailoverController');
  
  // Initialize alert manager
  const { alertManager } = await import('./infrastructure/monitoring/AlertManager');
  
  // Health checks and failover are automatically started in constructors
  logger.info('🏥 Cluster health monitoring and failover initialized');
  logger.info('🚨 Alert monitoring system initialized');

  // News archive cron jobs
  nodeCron.schedule('0 3 * * *', async () => {
    const count = await clusterNewsUseCase.archiveOld();
    if (count > 0) logger.info(`📰 Archived ${count} old news articles`);
  });
  nodeCron.schedule('0 4 * * 0', async () => {
    const count = await clusterNewsUseCase.deleteOld();
    if (count > 0) logger.info(`📰 Deleted ${count} old archived news articles`);
  });

  // Collection stats cleanup — воскресенье 04:30, удаляем статистику старше 7 дней
  nodeCron.schedule('30 4 * * 0', async () => {
    const { collectionStatRepository } = await import('./infrastructure/persistence/CollectionStatRepository');
    const count = await collectionStatRepository.deleteOlderThan(7);
    if (count > 0) logger.info(`📰 Deleted ${count} old collection stats`);
  });

  // Analytics events cleanup — воскресенье 05:00, удаляем события старше 90 дней
  nodeCron.schedule('0 5 * * 0', async () => {
    const { pageEventRepository } = await import('./infrastructure/persistence/PageEventRepository');
    const count = await pageEventRepository.deleteOlderThan(90);
    if (count > 0) logger.info(`📈 Deleted ${count} old analytics events`);
  });

  // SSL / HTTP server
  const sslKeyPath = path.join(process.cwd(), 'ssl', 'key.pem');
  const sslCertPath = path.join(process.cwd(), 'ssl', 'cert.pem');
  let server;

  if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
    try {
      server = https.createServer({
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath),
      }, app);
      console.log('🔒 HTTPS enabled');
    } catch {
      server = http.createServer(app);
    }
  } else {
    server = http.createServer(app);
  }

  // WebSocket
  const wsInstance = expressWs(app, server);
  const wss = wsInstance.getWss();
  (global as any).wss = wss;

  const { createWebSocketHandler } = await import('./websocket');
  createWebSocketHandler(app, '/ws');

  setInterval(() => {
    wss.clients.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
      }
    });
  }, 30000);

  // API routes
  await registerRoutes(app);

  if (app.get('env') === 'production') {
    serveStatic(app);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  const port = parseInt(process.env.PORT || '5000', 10);
  const isHttps = fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath);

  await clearPort(port);

  const listenOptions: { port: number; host: string; reusePort?: boolean } = {
    port,
    host: '0.0.0.0',
  };
  // reusePort is not supported reliably on Windows and can crash dev restarts.
  if (process.platform !== 'win32') {
    listenOptions.reusePort = true;
  }

  server.listen(listenOptions, () => {
    log(`🚀 Server running on ${isHttps ? 'https' : 'http'}://localhost:${port}`);
    healthMonitor.start();
  });
})();
