import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { noCache } from '../../middleware/cacheHeaders';
import { queryCacheService } from '../../infrastructure/monitoring/QueryCacheService';
import { BadRequestError } from '@newsaggregator/shared/utils';
import { sourceConfigRepository } from '../../infrastructure/persistence/SourceConfigRepository';
import type { SourceConfigKey } from '../../domain/monitoring/SourceConfig';
import { authenticateAdmin } from '../../middleware/security';

const router = Router();

const VALID_KEYS: SourceConfigKey[] = ['fast_interval_cron', 'slow_interval_cron', 'donate_methods_json', 'telegram_page_enabled'];
const ALLOWED_DONATE_PROTOCOLS = new Set(['https:', 'http:', 'tg:', 'mailto:']);

type DonateMethod = {
  title: string;
  value: string;
  note?: string;
  href?: string;
};

const sanitizeDonateMethods = (input: unknown): DonateMethod[] => {
  if (!Array.isArray(input)) throw new Error('must be an array');
  const normalized: DonateMethod[] = [];

  for (const row of input) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const title = String(item.title ?? '').trim();
    const value = String(item.value ?? '').trim();
    const note = String(item.note ?? '').trim();
    const href = String(item.href ?? '').trim();

    if (!title || !value) continue;
    if (href) {
      let parsed: URL;
      try {
        parsed = new URL(href);
      } catch {
        throw new Error(`invalid URL for method "${title}"`);
      }
      if (!ALLOWED_DONATE_PROTOCOLS.has(parsed.protocol)) {
        throw new Error(`unsupported URL protocol for method "${title}"`);
      }
    }

    normalized.push({ title, value, note, href });
  }

  if (!normalized.length) {
    throw new Error('at least one donate method with title/value is required');
  }

  return normalized;
};

router.use(authenticateAdmin);
router.use(noCache);

// ─── GET /api/admin/config ────────────────────────────────────────────────────

router.get('/', asyncHandler(async (_req, res) => {
  const configs = await sourceConfigRepository.getAll();
  res.json({ configs });
}));

// ─── PATCH /api/admin/config ──────────────────────────────────────────────────

router.patch('/', asyncHandler(async (req, res) => {
  const { key, value } = req.body;

  if (!key || !VALID_KEYS.includes(key)) {
    throw new BadRequestError(`key must be one of: ${VALID_KEYS.join(', ')}`);
  }
  if (!value?.trim()) {
    throw new BadRequestError('value is required');
  }

  const trimmedValue = value.trim();

  // Валидация cron-выражения только для cron-ключей
  if (key === 'fast_interval_cron' || key === 'slow_interval_cron') {
    const nodeCron = await import('node-cron');
    if (!nodeCron.validate(trimmedValue)) {
      throw new BadRequestError(`Invalid cron expression: "${trimmedValue}"`);
    }
  }

  if (key === 'telegram_page_enabled') {
    if (trimmedValue !== 'true' && trimmedValue !== 'false') {
      throw new BadRequestError('telegram_page_enabled must be "true" or "false"');
    }
    await sourceConfigRepository.set(key, trimmedValue);
    res.json({ ok: true, key, value: trimmedValue });
    return;
  }

  if (key === 'donate_methods_json') {
    try {
      const parsed = JSON.parse(trimmedValue) as unknown;
      const normalized = sanitizeDonateMethods(parsed);
      await sourceConfigRepository.set(key as SourceConfigKey, JSON.stringify(normalized));
      await queryCacheService.invalidateByPattern('*donate*');
      res.json({ ok: true, key, value: JSON.stringify(normalized) });
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'invalid donate methods';
      throw new BadRequestError(`donate_methods_json is invalid: ${message}`);
    }
  }

  await sourceConfigRepository.set(key as SourceConfigKey, trimmedValue);

  // Пересоздаём cron-задачи на лету
  const collector = (global as any).collectNewsUseCase;
  if (collector?.reloadCronFromDb) {
    await collector.reloadCronFromDb();
  }

  res.json({ ok: true, key, value: trimmedValue });
}));

export default router;
