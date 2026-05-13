import { Router } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { authenticateAdmin } from '../../../middleware/security';
import { BadRequestError, NotFoundError } from '../../../../shared/utils/errors';
import { db } from '../../../db/db';
import { weatherLocations } from '../../../../shared/types/schema';
import { eq } from 'drizzle-orm';
import { executeWeatherCollection } from '../../../application/weather/WeatherCollectionService';
import { invalidateCache, invalidateByTags } from '../../../middleware/advancedCache';

const router = Router();
router.use(authenticateAdmin);

// GET /api/admin/weather/locations — все города включая неактивные
router.get('/locations', asyncHandler(async (_req, res) => {
  const locations = await db
    .select()
    .from(weatherLocations)
    .orderBy(weatherLocations.sortOrder, weatherLocations.name);
  res.json({ locations });
}));

// POST /api/admin/weather/locations — добавить город
router.post('/locations', asyncHandler(async (req, res) => {
  const { name, nameEn, country, latitude, longitude, timezone, sortOrder } = req.body;
  if (!name || !nameEn || latitude == null || longitude == null) {
    throw new BadRequestError('name, nameEn, latitude, longitude required');
  }

  const [location] = await db
    .insert(weatherLocations)
    .values({
      name,
      nameEn,
      country: country ?? 'Russia',
      latitude: String(latitude),
      longitude: String(longitude),
      timezone: timezone ?? 'Europe/Moscow',
      sortOrder: sortOrder ?? 0,
    })
    .returning();

  await invalidateCache('weather:locations');
  res.status(201).json({ location });
}));

// PATCH /api/admin/weather/locations/:id — изменить город
router.patch('/locations/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) throw new BadRequestError('Invalid id');

  const { name, nameEn, country, latitude, longitude, timezone, isActive, sortOrder } = req.body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined)      updates.name = name;
  if (nameEn !== undefined)    updates.nameEn = nameEn;
  if (country !== undefined)   updates.country = country;
  if (latitude !== undefined)  updates.latitude = String(latitude);
  if (longitude !== undefined) updates.longitude = String(longitude);
  if (timezone !== undefined)  updates.timezone = timezone;
  if (isActive !== undefined)  updates.isActive = isActive;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;

  const [location] = await db
    .update(weatherLocations)
    .set(updates)
    .where(eq(weatherLocations.id, id))
    .returning();

  if (!location) throw new NotFoundError('Location not found');

  await invalidateCache('weather:locations');
  res.json({ location });
}));

// DELETE /api/admin/weather/locations/:id — удалить город
router.delete('/locations/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) throw new BadRequestError('Invalid id');

  const [deleted] = await db
    .delete(weatherLocations)
    .where(eq(weatherLocations.id, id))
    .returning({ id: weatherLocations.id });

  if (!deleted) throw new NotFoundError('Location not found');

  await invalidateCache('weather:locations');
  res.json({ ok: true });
}));

// POST /api/admin/weather/collect — ручной запуск сбора
router.post('/collect', asyncHandler(async (_req, res) => {
  const result = await executeWeatherCollection();
  // Инвалидация серверного кэша
  await invalidateByTags(['weather']);
  // Инвалидация всех ключей weather:week:*
  const keys = ['weather:locations'];
  for (let i = 1; i <= 100; i++) keys.push(`weather:week:${i}`);
  await Promise.all(keys.map(k => invalidateCache(k)));
  res.json({ ok: true, ...result });
}));

export default router;
