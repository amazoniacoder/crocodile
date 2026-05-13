import * as nodeCron from 'node-cron';
import { db } from '../../db/db';
import { weatherLocations, weatherForecasts, weatherHourlyForecasts } from '../../../shared/types/schema';
import { eq, sql, lt, and } from 'drizzle-orm';
import { fetchForecast, fetchHourlyRange } from '../../infrastructure/weather/OpenMeteoClient';
import { getCurrentKpIndex } from '../../infrastructure/weather/NoaaKpClient';
import { getMoonPhase } from '../../infrastructure/weather/MoonPhaseCalculator';
import { logger } from '../../utils/logger';
import { queryCacheService } from '../../infrastructure/monitoring/QueryCacheService';

export async function executeWeatherCollection(): Promise<{ collected: number; errors: number }> {
  let collected = 0;
  let errors = 0;

  const kp = await getCurrentKpIndex();

  const locations = await db
    .select()
    .from(weatherLocations)
    .where(eq(weatherLocations.isActive, true))
    .orderBy(weatherLocations.sortOrder);

  for (const loc of locations) {
    try {
      const days = await fetchForecast(
        Number(loc.latitude),
        Number(loc.longitude),
        loc.timezone
      );

      // Сохраняем дневные прогнозы
      for (const day of days) {
        const date = new Date(`${day.date}T12:00:00Z`);
        const moon = getMoonPhase(date);

        await db
          .insert(weatherForecasts)
          .values({
            locationId:                  loc.id,
            forecastDate:                day.date,
            tempMin:                     day.tempMin != null ? String(day.tempMin) : null,
            tempMax:                     day.tempMax != null ? String(day.tempMax) : null,
            precipitationMm:             day.precipitationMm != null ? String(day.precipitationMm) : null,
            windSpeedKmh:                day.windSpeedKmh != null ? String(day.windSpeedKmh) : null,
            windGustsKmh:                day.windGustsKmh != null ? String(day.windGustsKmh) : null,
            windDirectionDeg:            day.windDirectionDeg ?? null,
            humidityPct:                 day.humidityPct ?? null,
            precipitationProbabilityPct: day.precipitationProbabilityPct ?? null,
            pressureHpa:                 null,
            weatherCode:                 day.weatherCode ?? null,
            moonPhase:                   String(moon.phase),
            moonPhaseName:               moon.name,
            kpIndex:                     kp?.kpIndex != null ? String(kp.kpIndex) : null,
            kpLevel:                     kp?.kpLevel ?? null,
            uvIndexMax:                  day.uvIndexMax != null ? String(day.uvIndexMax) : null,
          })
          .onConflictDoUpdate({
            target: [weatherForecasts.locationId, weatherForecasts.forecastDate],
            set: {
              tempMin:                     sql`EXCLUDED.temp_min`,
              tempMax:                     sql`EXCLUDED.temp_max`,
              precipitationMm:             sql`EXCLUDED.precipitation_mm`,
              windSpeedKmh:                sql`EXCLUDED.wind_speed_kmh`,
              windGustsKmh:                sql`EXCLUDED.wind_gusts_kmh`,
              windDirectionDeg:            sql`EXCLUDED.wind_direction_deg`,
              humidityPct:                 sql`EXCLUDED.humidity_pct`,
              precipitationProbabilityPct: sql`EXCLUDED.precipitation_probability_pct`,
              pressureHpa:                 sql`EXCLUDED.pressure_hpa`,
              weatherCode:                 sql`EXCLUDED.weather_code`,
              moonPhase:                   sql`EXCLUDED.moon_phase`,
              moonPhaseName:               sql`EXCLUDED.moon_phase_name`,
              kpIndex:                     kp ? sql`EXCLUDED.kp_index` : sql`weather_forecasts.kp_index`,
              kpLevel:                     kp ? sql`EXCLUDED.kp_level` : sql`weather_forecasts.kp_level`,
              uvIndexMax:                  sql`EXCLUDED.uv_index_max`,
              fetchedAt:                   sql`NOW()`,
            },
          });
      }

      // Сохраняем почасовку (7 дней одним запросом)
      if (days.length > 0) {
        const startDate = days[0].date;
        const endDate   = days[days.length - 1].date;
        try {
          const hourly = await fetchHourlyRange(
            Number(loc.latitude),
            Number(loc.longitude),
            loc.timezone,
            startDate,
            endDate
          );

          // Вычисляем среднесуточное давление по часовым данным
          const pressureByDate = new Map<string, number[]>();
          for (const h of hourly) {
            if (h.pressureHpa == null) continue;
            if (!pressureByDate.has(h.date)) pressureByDate.set(h.date, []);
            pressureByDate.get(h.date)!.push(Number(h.pressureHpa));
          }

          // Обновляем давление в дневных прогнозах
          for (const [date, values] of pressureByDate) {
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            await db
              .update(weatherForecasts)
              .set({ pressureHpa: avg.toFixed(1) })
              .where(and(
                eq(weatherForecasts.locationId, loc.id),
                sql`${weatherForecasts.forecastDate} = ${date}::date`
              ));
          }

          // Батчевая вставка по 100 строк
          const BATCH = 100;
          for (let i = 0; i < hourly.length; i += BATCH) {
            const batch = hourly.slice(i, i + BATCH).map(h => ({
              locationId:    loc.id,
              forecastDt:    new Date(`${h.date}T${h.time}:00:00`),
              temp:          h.temp != null ? String(h.temp) : null,
              apparentTemp:  h.apparentTemp != null ? String(h.apparentTemp) : null,
              weatherCode:   h.weatherCode ?? null,
              windSpeed:     h.windSpeed != null ? String(h.windSpeed) : null,
              windGusts:     h.windGusts != null ? String(h.windGusts) : null,
              windDir:       h.windDirection ?? null,
              precipitation: h.precipitation != null ? String(h.precipitation) : null,
              pressureHpa:   h.pressureHpa != null ? String(h.pressureHpa) : null,
            }));

            await db
              .insert(weatherHourlyForecasts)
              .values(batch)
              .onConflictDoUpdate({
                target: [weatherHourlyForecasts.locationId, weatherHourlyForecasts.forecastDt],
                set: {
                  temp:          sql`EXCLUDED.temp`,
                  apparentTemp:  sql`EXCLUDED.apparent_temp`,
                  weatherCode:   sql`EXCLUDED.weather_code`,
                  windSpeed:     sql`EXCLUDED.wind_speed`,
                  windGusts:     sql`EXCLUDED.wind_gusts`,
                  windDir:       sql`EXCLUDED.wind_dir`,
                  precipitation: sql`EXCLUDED.precipitation`,
                  pressureHpa:   sql`EXCLUDED.pressure_hpa`,
                  fetchedAt:     sql`NOW()`,
                },
              });
          }
        } catch (hourlyErr) {
          logger.warn(`🌤 Hourly collection failed for ${loc.name}:`, hourlyErr);
        }
      }

      collected++;
      logger.info(`🌤 Weather collected: ${loc.name}, days: ${days.length}`);
    } catch (err) {
      errors++;
      logger.warn(`🌤 Weather collection failed for ${loc.name}:`, err);
    }
  }

  logger.info(`🌤 Weather collection done: ${collected} cities, ${errors} errors`);
  await queryCacheService.invalidateByTags(['weather']);
  return { collected, errors };
}

// Задача 3: очистка старых данных
export async function executeWeatherCleanup(): Promise<void> {
  const cutoffDaily  = sql`NOW() - INTERVAL '14 days'`;
  const cutoffHourly = sql`NOW() - INTERVAL '10 days'`;

  const [dailyResult, hourlyResult] = await Promise.all([
    db.delete(weatherForecasts).where(sql`${weatherForecasts.forecastDate} < ${cutoffDaily}`),
    db.delete(weatherHourlyForecasts).where(lt(weatherHourlyForecasts.forecastDt, sql`NOW() - INTERVAL '10 days'`)),
  ]);

  logger.info(`🌤 Weather cleanup: daily=${(dailyResult as any).rowCount ?? 0}, hourly=${(hourlyResult as any).rowCount ?? 0}`);
}

export function startWeatherCollectionJob(): void {
  // Сбор каждые 3 часа
  nodeCron.schedule('0 */3 * * *', async () => {
    try { await executeWeatherCollection(); }
    catch (err) { logger.error('Weather collection job failed:', err); }
  });

  // Очистка каждое воскресенье в 06:00
  nodeCron.schedule('0 6 * * 0', async () => {
    try { await executeWeatherCleanup(); }
    catch (err) { logger.error('Weather cleanup job failed:', err); }
  });

  // Первый прогон через 10 секунд
  setTimeout(() => executeWeatherCollection().catch(err =>
    logger.error('Initial weather collection failed:', err)
  ), 10_000);
}
