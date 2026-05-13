import { Router } from 'express';
import { z } from 'zod';
import { webPushService } from '../../infrastructure/push/WebPushService';
import { asyncHandler } from '../../middleware/errorHandler';
import { BadRequestError } from '../../../shared/utils/errors';
import { authenticateAdmin } from '../../middleware/security';
import { db } from '../../db/db';
import { pushSubscriptions } from '../../../shared/types/schema';
import { sql } from 'drizzle-orm';

const router = Router();

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(10),
    auth: z.string().min(10),
  }),
});

router.get('/vapid-public-key', (_req, res) => {
  const key = webPushService.getPublicKey();
  if (!key) return res.status(503).json({ success: false, error: 'Push notifications not configured' });
  res.json({ success: true, publicKey: key });
});

router.get('/stats', authenticateAdmin, asyncHandler(async (_req, res) => {
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(pushSubscriptions);
  res.json({
    success: true,
    enabled: webPushService.isEnabled(),
    subscriptions: Number(count),
    threshold: parseInt(process.env.PUSH_THRESHOLD ?? '5', 10),
  });
}));

router.post('/subscribe', asyncHandler(async (req, res) => {
  const result = subscribeSchema.safeParse(req.body);
  if (!result.success) throw new BadRequestError('Invalid subscription data');
  await webPushService.saveSubscription(result.data);
  res.status(201).json({ success: true });
}));

router.delete('/subscribe', asyncHandler(async (req, res) => {
  const { endpoint } = req.body ?? {};
  if (!endpoint || typeof endpoint !== 'string') throw new BadRequestError('endpoint required');
  await webPushService.deleteSubscription(endpoint);
  res.json({ success: true });
}));

export default router;
