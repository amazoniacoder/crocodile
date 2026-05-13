import { Router } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { authenticateAdmin } from '../../../middleware/security';
import { telegramSubscriptionService } from '../../../infrastructure/telegram/TelegramSubscriptionService';
import { BadRequestError } from '../../../../shared/utils/errors';
import { z } from 'zod';

const router = Router();

router.use(authenticateAdmin);

const createSubscriptionSchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const subscriptions = await telegramSubscriptionService.listAll();
  
  res.json({
    success: true,
    subscriptions,
    total: subscriptions.length,
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  const validation = createSubscriptionSchema.safeParse(req.body);
  
  if (!validation.success) {
    throw new BadRequestError(validation.error.errors[0].message);
  }

  const { name, expiresInDays } = validation.data;

  const result = await telegramSubscriptionService.generateToken({
    name,
    expiresInDays,
    createdBy: 'admin',
  });

  res.status(201).json({
    success: true,
    token: result.token,
    id: result.id,
    expiresAt: result.expiresAt,
  });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const success = await telegramSubscriptionService.revokeToken(id);

  if (!success) {
    throw new BadRequestError('Subscription not found');
  }

  res.json({
    success: true,
    message: 'Subscription revoked',
  });
}));

export default router;
