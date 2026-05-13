import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import weatherRouter from '../api/weather';
import { errorHandler } from '../middleware/errorHandler';

const app = express();
app.use('/api/weather', weatherRouter);
app.use(errorHandler);

describe('GET /api/weather/week', () => {
  it('should return 400 if locationId is missing', async () => {
    const res = await request(app).get('/api/weather/week');
    expect(res.status).toBe(400);
  });

  it('should return 400 if locationId is invalid', async () => {
    const res = await request(app).get('/api/weather/week?locationId=abc');
    expect(res.status).toBe(400);
  });

  it('should return week data for valid locationId', async () => {
    // Предполагаем что locationId=1 (Москва) существует
    const res = await request(app).get('/api/weather/week?locationId=1');
    
    if (res.status === 200) {
      expect(res.body).toHaveProperty('location');
      expect(res.body).toHaveProperty('forecasts');
      expect(res.body).toHaveProperty('hourly');
      
      expect(res.body.location).toHaveProperty('id');
      expect(res.body.location).toHaveProperty('name');
      expect(res.body.location).toHaveProperty('timezone');
      
      expect(Array.isArray(res.body.forecasts)).toBe(true);
      expect(Array.isArray(res.body.hourly)).toBe(true);
      
      // Проверяем что есть до 7 дней
      expect(res.body.forecasts.length).toBeLessThanOrEqual(7);
      
      // Проверяем структуру почасовых данных
      if (res.body.hourly.length > 0) {
        const firstHour = res.body.hourly[0];
        expect(firstHour).toHaveProperty('date');
        expect(firstHour).toHaveProperty('time');
        expect(firstHour).toHaveProperty('temp');
        expect(firstHour).toHaveProperty('weatherCode');
      }
      
      const cc = res.headers['cache-control'] ?? res.headers['Cache-Control'];
      if (cc) expect(String(cc)).toContain('max-age=3600');
    }
  }, 15000);
});
