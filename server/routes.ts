import { Express } from "express";
import apiRoutes from "./api";
import { noCache as apiBrowserNoCacheMiddleware } from "./middleware/cacheHeaders";

const SITE_URL = process.env.SITE_URL || 'https://blogpro.ru';

const STATIC_ROUTES = [
  '/',
  '/all',
  '/all/economy',
  '/all/tech',
  '/all/politics',
  '/all/society',
  '/all/other',
  '/russia',
  '/russia/economy',
  '/russia/tech',
  '/russia/politics',
  '/russia/society',
  '/russia/other',
  '/world',
  '/world/economy',
  '/world/tech',
  '/world/politics',
  '/world/society',
  '/world/other',
];

export async function registerRoutes(app: Express) {
  try {
    console.log("🔧 Registering API routes...");
    
    // Prometheus metrics endpoint (без префикса /api)
    const metricsRoutes = (await import('./api/metrics')).default;
    app.use('/metrics', metricsRoutes);
    
    // По умолчанию API без браузерного max-age (раньше вешали public max-age=300 на все ответы).
    // Явное кеширование — только там, где на маршруте стоит setCacheHeaders (например лента /api/news).
    app.use("/api", apiBrowserNoCacheMiddleware, apiRoutes);
    console.log("✅ API routes registered successfully");
  } catch (error) {
    console.error("❌ Failed to register API routes:", error);
    throw error;
  }

  app.get('/sitemap.xml', (_req, res) => {
    const urls = STATIC_ROUTES.map(path => `
  <url>
    <loc>${SITE_URL}${path}</loc>
    <changefreq>${path === '/' || path === '/all' ? 'always' : 'hourly'}</changefreq>
    <priority>${path === '/' ? '1.0' : path.split('/').length === 2 ? '0.8' : '0.6'}</priority>
  </url>`).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;

    res.set('Content-Type', 'application/xml').send(xml);
  });
}