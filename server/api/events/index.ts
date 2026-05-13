import { Router } from 'express';
import { createHash } from 'crypto';
import rateLimit from 'express-rate-limit';
import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate, schemas } from '../../middleware/validation';
import { sanitizationMiddleware } from '../../middleware/sanitization';
import { pageEventRepository } from '../../infrastructure/persistence/PageEventRepository';

const router = Router();

// Применяем санитизацию
router.use(sanitizationMiddleware);

const eventsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

// ─── POST /api/events ─────────────────────────────────────────────────────────

router.post('/', 
  eventsLimiter, 
  validate.body(schemas.analyticsEvent),
  asyncHandler(async (req, res) => {
  const { type, path, articleId, duration } = req.body;

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '';
  const ua = req.headers['user-agent'] ?? '';
  const date = new Date().toISOString().slice(0, 10);
  const dailyHash = createHash('sha256').update(`${ip}${ua}${date}`).digest('hex').slice(0, 16);

  // GeoIP: определяем страну и город, IP не хранится
  const geo = geoip.lookup(ip);
  const country = geo?.country || null;
  const city = geo?.city || null;

  // User-Agent: определяем тип устройства, UA не хранится
  const parser = new UAParser(ua);
  const device = parser.getDevice();
  const deviceType = device.type || 'desktop';

  // Referrer: сохраняем только домен
  const referrer = req.headers.referer;
  let referrerDomain = null;
  if (referrer) {
    try {
      referrerDomain = new URL(referrer).hostname;
    } catch {}
  }

  await pageEventRepository.insert({
    type,
    path,
    articleId,
    dailyHash,
    country,
    city,
    deviceType,
    referrerDomain,
    durationSeconds: duration,
  });

  res.json({ ok: true });
}));

export default router;
