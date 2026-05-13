import { Router, type Request, type Response, type NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { asyncHandler } from '../../middleware/errorHandler';
import { BadRequestError, NotFoundError } from '../../../shared/utils/errors';
import { db } from '../../db/db';
import { weatherLocations, weatherForecasts, weatherHourlyForecasts } from '../../../shared/types/schema';
import { eq, and, sql, asc, gte, lte } from 'drizzle-orm';
import { advancedCache } from '../../middleware/advancedCache';
import { fetchHourly, fetchHourlyRange } from '../../infrastructure/weather/OpenMeteoClient';

const router = Router();

function requireWeatherLocationId(req: Request, _res: Response, next: NextFunction) {
  const locationId = parseInt(req.query.locationId as string);
  if (!Number.isFinite(locationId) || locationId < 1) {
    return next(new BadRequestError('locationId required'));
  }
  next();
}

// GET /api/weather/week?locationId=1
router.get('/week',
  requireWeatherLocationId,
  advancedCache({ ttl: 3600, tags: ['weather'], keyGenerator: (req) => `weather:week:${req.query.locationId}` }),
  asyncHandler(async (req, res) => {
    const locationId = parseInt(req.query.locationId as string);

    const [location] = await db
      .select()
      .from(weatherLocations)
      .where(and(eq(weatherLocations.id, locationId), eq(weatherLocations.isActive, true)))
      .limit(1);

    if (!location) throw new NotFoundError('Location not found');

    const today = new Date().toLocaleDateString('sv-SE');

    const forecasts = await db
      .select()
      .from(weatherForecasts)
      .where(and(
        eq(weatherForecasts.locationId, locationId),
        sql`${weatherForecasts.forecastDate} >= ${today}::date`
      ))
      .orderBy(asc(weatherForecasts.forecastDate))
      .limit(7);

    const normalizedForecasts = forecasts.map(f => ({
      ...f,
      forecastDate:
        typeof f.forecastDate === 'object' && f.forecastDate !== null && 'toISOString' in f.forecastDate
          ? (f.forecastDate as Date).toISOString().slice(0, 10)
          : String(f.forecastDate).slice(0, 10),
    }));

    let hourlyData: Array<{
      date: string; time: string;
      temp: number | null; apparentTemp: number | null; weatherCode: number | null;
      windSpeed: number | null; windGusts: number | null; windDirection: number | null;
      precipitation: number | null; pressureHpa: number | null;
    }> = [];

    if (normalizedForecasts.length > 0) {
      const start = normalizedForecasts[0].forecastDate;
      const end   = normalizedForecasts[normalizedForecasts.length - 1].forecastDate;

      // Читаем из БД
      const dbHourly = await db
        .select()
        .from(weatherHourlyForecasts)
        .where(and(
          eq(weatherHourlyForecasts.locationId, locationId),
          gte(weatherHourlyForecasts.forecastDt, new Date(`${start}T00:00:00`)),
          lte(weatherHourlyForecasts.forecastDt, new Date(`${end}T23:59:59`))
        ))
        .orderBy(asc(weatherHourlyForecasts.forecastDt));

      if (dbHourly.length > 0) {
        hourlyData = dbHourly.map(h => {
          const dt = h.forecastDt instanceof Date ? h.forecastDt : new Date(h.forecastDt);
          // Конвертируем UTC в локальное время города
          const localStr = dt.toLocaleString('sv-SE', { timeZone: location.timezone });
          return {
            date:          localStr.slice(0, 10),
            time:          localStr.slice(11, 13),
            temp:          h.temp != null ? Number(h.temp) : null,
            apparentTemp:  h.apparentTemp != null ? Number(h.apparentTemp) : null,
            weatherCode:   h.weatherCode,
            windSpeed:     h.windSpeed != null ? Number(h.windSpeed) : null,
            windGusts:     h.windGusts != null ? Number(h.windGusts) : null,
            windDirection: h.windDir,
            precipitation: h.precipitation != null ? Number(h.precipitation) : null,
            pressureHpa:   h.pressureHpa != null ? Number(h.pressureHpa) : null,
          };
        });
      } else {
        // Fallback: живой запрос к Open-Meteo
        logger.warn(`Weather hourly DB miss for locationId=${locationId}, falling back to Open-Meteo`);
        try {
          hourlyData = await fetchHourlyRange(
            Number(location.latitude),
            Number(location.longitude),
            location.timezone,
            start,
            end
          );
        } catch (err) {
          logger.warn(`fetchHourlyRange fallback failed for ${start}…${end}:`, err);
          for (const forecast of normalizedForecasts) {
            try {
              const hours = await fetchHourly(
                Number(location.latitude),
                Number(location.longitude),
                location.timezone,
                forecast.forecastDate
              );
              hourlyData.push(...hours.map(h => ({ date: forecast.forecastDate, ...h })));
            } catch (dayErr) {
              logger.warn(`Failed to fetch hourly for ${forecast.forecastDate}:`, dayErr);
            }
          }
        }
      }
    }

    res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
    res.json({
      location: {
        id: location.id, name: location.name,
        country: location.country, timezone: location.timezone,
      },
      forecasts: normalizedForecasts,
      hourly: hourlyData,
    });
  })
);

// GET /api/weather/locations
router.get('/locations',
  advancedCache({ ttl: 3600, tags: ['weather'], keyGenerator: () => 'weather:locations' }),
  asyncHandler(async (_req, res) => {
    const locations = await db
      .select({
        id:        weatherLocations.id,
        name:      weatherLocations.name,
        country:   weatherLocations.country,
        latitude:  weatherLocations.latitude,
        longitude: weatherLocations.longitude,
        timezone:  weatherLocations.timezone,
      })
      .from(weatherLocations)
      .where(eq(weatherLocations.isActive, true))
      .orderBy(asc(weatherLocations.sortOrder), asc(weatherLocations.name));

    res.json({ locations });
  })
);

// GET /api/weather/hourly?locationId=1&date=2026-05-04
router.get('/hourly',
  asyncHandler(async (req, res) => {
    const locationId = parseInt(req.query.locationId as string);
    const date = req.query.date as string;

    if (!Number.isFinite(locationId) || locationId < 1) throw new BadRequestError('locationId required');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestError('date required (YYYY-MM-DD)');

    const [location] = await db
      .select()
      .from(weatherLocations)
      .where(and(eq(weatherLocations.id, locationId), eq(weatherLocations.isActive, true)))
      .limit(1);

    if (!location) throw new NotFoundError('Location not found');

    // Читаем из БД
    const dbHourly = await db
      .select()
      .from(weatherHourlyForecasts)
      .where(and(
        eq(weatherHourlyForecasts.locationId, locationId),
        gte(weatherHourlyForecasts.forecastDt, new Date(`${date}T00:00:00`)),
        lte(weatherHourlyForecasts.forecastDt, new Date(`${date}T23:59:59`))
      ))
      .orderBy(asc(weatherHourlyForecasts.forecastDt));

    if (dbHourly.length > 0) {
      const hours = dbHourly.map(h => {
        const dt = h.forecastDt instanceof Date ? h.forecastDt : new Date(h.forecastDt);
        const localStr = dt.toLocaleString('sv-SE', { timeZone: location.timezone });
        return {
          time:          localStr.slice(11, 13),
          temp:          h.temp != null ? Number(h.temp) : null,
          apparentTemp:  h.apparentTemp != null ? Number(h.apparentTemp) : null,
          weatherCode:   h.weatherCode,
          windSpeed:     h.windSpeed != null ? Number(h.windSpeed) : null,
          windGusts:     h.windGusts != null ? Number(h.windGusts) : null,
          windDirection: h.windDir,
          precipitation: h.precipitation != null ? Number(h.precipitation) : null,
          pressureHpa:   h.pressureHpa != null ? Number(h.pressureHpa) : null,
        };
      });
      res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
      return res.json({ hours });
    }

    // Fallback на Open-Meteo
    const hours = await fetchHourly(
      Number(location.latitude),
      Number(location.longitude),
      location.timezone,
      date
    );

    res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
    res.json({ hours });
  })
);

// GET /api/weather?locationId=1
router.get('/',
  asyncHandler(async (req, res) => {
    const locationId = parseInt(req.query.locationId as string);
    if (!Number.isFinite(locationId) || locationId < 1) throw new BadRequestError('locationId required');

    const [location] = await db
      .select()
      .from(weatherLocations)
      .where(and(eq(weatherLocations.id, locationId), eq(weatherLocations.isActive, true)))
      .limit(1);

    if (!location) throw new NotFoundError('Location not found');

    const today = new Date().toLocaleDateString('sv-SE');

    const forecasts = await db
      .select()
      .from(weatherForecasts)
      .where(and(
        eq(weatherForecasts.locationId, locationId),
        sql`${weatherForecasts.forecastDate} >= ${today}::date`
      ))
      .orderBy(asc(weatherForecasts.forecastDate))
      .limit(7);

    const normalizedForecasts = forecasts.map(f => ({
      ...f,
      forecastDate:
        typeof f.forecastDate === 'object' && f.forecastDate !== null && 'toISOString' in f.forecastDate
          ? (f.forecastDate as Date).toISOString().slice(0, 10)
          : String(f.forecastDate).slice(0, 10),
    }));

    res.json({ location, forecasts: normalizedForecasts });
  })
);

export default router;
