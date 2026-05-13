import { Router } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { authenticateAdmin } from '../../../middleware/security';
import { userTokenRepository } from '../../../infrastructure/persistence/UserTokenRepository';
import { userSubscriptionRepository } from '../../../infrastructure/persistence/UserSubscriptionRepository';
import { userTokenService } from '../../../infrastructure/auth/UserTokenService';
import { auditLogger } from '../../../infrastructure/audit/AuditLogger';
import { BadRequestError, NotFoundError } from '../../../../shared/utils/errors';
import { db } from '../../../db/db';
import { newsSources } from '../../../../shared/types/schema';
import { inArray } from 'drizzle-orm';

const router = Router();

// Все роуты требуют admin-аутентификации
router.use(authenticateAdmin);

// GET /api/admin/user-tokens — список всех токенов
router.get('/', asyncHandler(async (req, res) => {
  const tokens = await userTokenRepository.findAll();
  
  // Добавляем количество подписок для каждого токена
  const tokensWithStats = await Promise.all(
    tokens.map(async (token) => {
      const sourceIds = await userSubscriptionRepository.findByTokenId(token.id);
      return {
        ...token,
        subscriptionsCount: sourceIds.length,
      };
    })
  );

  res.json({ tokens: tokensWithStats });
}));

// POST /api/admin/user-tokens — создать токен
router.post('/', asyncHandler(async (req, res) => {
  const { label, expiresAt } = req.body;

  if (!label || typeof label !== 'string' || label.trim().length === 0) {
    throw new BadRequestError('label is required');
  }

  const expiresAtDate = expiresAt ? new Date(expiresAt) : undefined;
  if (expiresAtDate && isNaN(expiresAtDate.getTime())) {
    throw new BadRequestError('Invalid expiresAt date');
  }

  const token = await userTokenRepository.insert({
    label: label.trim(),
    expiresAt: expiresAtDate,
  });

  await auditLogger.log({
    action: 'CREATE',
    resource: 'user_token',
    resourceId: token.id.toString(),
    newValue: { label: token.label, expiresAt: token.expiresAt },
    ip: req.ip ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? 'unknown',
    success: true,
  });

  res.json({ token });
}));

// PATCH /api/admin/user-tokens/:id — обновить токен
router.patch('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) throw new BadRequestError('Invalid token ID');

  const { label, isActive, expiresAt } = req.body;
  const updates: any = {};

  if (label !== undefined) {
    if (typeof label !== 'string') throw new BadRequestError('label must be a string');
    updates.label = label.trim();
  }

  if (isActive !== undefined) {
    if (typeof isActive !== 'boolean') throw new BadRequestError('isActive must be a boolean');
    updates.isActive = isActive;
  }

  if (expiresAt !== undefined) {
    if (expiresAt === null) {
      updates.expiresAt = null;
    } else {
      const date = new Date(expiresAt);
      if (isNaN(date.getTime())) throw new BadRequestError('Invalid expiresAt date');
      updates.expiresAt = date;
    }
  }

  await userTokenRepository.update(id, updates);

  // Инвалидируем кэш токена
  const token = await userTokenRepository.findById(id);
  if (token) {
    await userTokenService.invalidateCache(token.token);
  }

  await auditLogger.log({
    action: 'UPDATE',
    resource: 'user_token',
    resourceId: id.toString(),
    newValue: updates,
    ip: req.ip ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? 'unknown',
    success: true,
  });

  res.json({ ok: true });
}));

// DELETE /api/admin/user-tokens/:id — удалить токен
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) throw new BadRequestError('Invalid token ID');

  const token = await userTokenRepository.findById(id);
  if (!token) throw new NotFoundError('Token not found');

  await userTokenRepository.delete(id);

  // Инвалидируем кэш
  await userTokenService.invalidateCache(token.token);

  await auditLogger.log({
    action: 'DELETE',
    resource: 'user_token',
    resourceId: id.toString(),
    oldValue: { label: token.label },
    ip: req.ip ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? 'unknown',
    success: true,
  });

  res.json({ ok: true });
}));

// GET /api/admin/user-tokens/stats — статистика
router.get('/stats', asyncHandler(async (_req, res) => {
  const tokenStats = await userTokenRepository.getStats();
  const subStats = await userSubscriptionRepository.getStats();

  res.json({
    activeTokens: tokenStats.activeTokens,
    totalTokens: tokenStats.totalTokens,
    totalSubscriptions: subStats.totalSubscriptions,
  });
}));

// GET /api/admin/user-tokens/details — детализация подписок
router.get('/details', asyncHandler(async (_req, res) => {
  const tokens = await userTokenRepository.findAll();
  
  const tokensWithDetails = await Promise.all(
    tokens.map(async (token) => {
      const sourceIds = await userSubscriptionRepository.findByTokenId(token.id);
      
      // Получаем информацию о каналах
      const sources = sourceIds.length > 0
        ? await db.select({
            id: newsSources.id,
            name: newsSources.name,
            sourceType: newsSources.sourceType,
          })
          .from(newsSources)
          .where(inArray(newsSources.id, sourceIds))
        : [];

      return {
        id: token.id,
        label: token.label,
        isActive: token.isActive,
        createdAt: token.createdAt,
        expiresAt: token.expiresAt,
        lastUsedAt: token.lastUsedAt,
        subscriptions: sources,
      };
    })
  );

  res.json({ tokens: tokensWithDetails });
}));

// GET /api/admin/user-tokens/:id/subscriptions — подписки токена
router.get('/:id/subscriptions', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) throw new BadRequestError('Invalid token ID');

  const sourceIds = await userSubscriptionRepository.findByTokenId(id);
  res.json({ sourceIds });
}));

// POST /api/admin/user-tokens/:id/subscriptions — управление подписками
router.post('/:id/subscriptions', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) throw new BadRequestError('Invalid token ID');

  const { sourceIds } = req.body;

  if (!Array.isArray(sourceIds)) {
    throw new BadRequestError('sourceIds must be an array');
  }

  const validIds = sourceIds.filter(sid => typeof sid === 'number' && sid > 0);

  await userSubscriptionRepository.replaceSubscriptions(id, validIds);

  await auditLogger.log({
    action: 'UPDATE',
    resource: 'user_subscriptions',
    resourceId: id.toString(),
    newValue: { sourceIds: validIds },
    ip: req.ip ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? 'unknown',
    success: true,
  });

  res.json({ ok: true, sourceIds: validIds });
}));

export default router;
