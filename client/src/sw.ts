/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkOnly, NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Переопределяем self как ServiceWorkerGlobalScope — tsconfig использует DOM lib,
// поэтому без явного cast self резолвится как Window.
declare const self: ServiceWorkerGlobalScope & typeof globalThis;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA fallback — NetworkFirst с таймаутом 3 сек, fallback на precache index.html
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'pages',
      networkTimeoutSeconds: 3,
      plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
    }),
    { denylist: [/^\/api\//] }
  )
);

// Изображения — CacheFirst
registerRoute(
  /\.(?:png|jpe?g|webp|gif|svg)(?:[?#].*)?$/i,
  new CacheFirst({
    cacheName: 'news-images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 7 * 24 * 60 * 60, purgeOnQuotaError: true }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// API — только сеть, кроме погоды (NetworkFirst с fallback на IDB)
registerRoute(
  /^\/api\/weather\//,
  async ({ request, event }) => {
    try {
      // Пытаемся загрузить с сервера
      const response = await fetch(request);
      return response;
    } catch (err) {
      // Офлайн: пытаемся вернуть из IndexedDB
      const url = new URL(request.url);
      
      // Только для /api/weather/week
      if (url.pathname.includes('/week')) {
        const locationId = url.searchParams.get('locationId');
        
        if (locationId) {
          try {
            // Открываем IndexedDB напрямую в SW
            const db = await openWeatherDB();
            const data = await getWeatherFromIDB(db, parseInt(locationId));
            
            if (data) {
              return new Response(JSON.stringify(data), {
                headers: { 
                  'Content-Type': 'application/json',
                  'X-Cache': 'indexeddb'
                }
              });
            }
          } catch (idbErr) {
            console.error('[SW] Failed to read from IndexedDB:', idbErr);
          }
        }
      }
      
      // Нет данных — возвращаем 503
      return new Response(
        JSON.stringify({ error: 'Offline and no cached data' }),
        { 
          status: 503, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  }
);

registerRoute(/^\/api\//, new NetworkOnly());

// Push-уведомления
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; url?: string } = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Новые статьи', body: event.data.text() };
  }

  const title = payload.title ?? 'Новые статьи';
  const options: NotificationOptions = {
    body: payload.body ?? '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: { url: payload.url ?? '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Клик по уведомлению — открыть/сфокусировать вкладку
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url: string = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});

// Prompt-стратегия: SW ждёт skipWaiting от клиента
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ============================================================================
// IndexedDB helpers для офлайн-режима погоды
// ============================================================================

function openWeatherDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('weather-cache', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getWeatherFromIDB(db: IDBDatabase, locationId: number): Promise<any> {
  const now = Date.now();
  const CACHE_TTL = 60 * 60 * 1000; // 1 час

  // Читаем локацию
  const location = await new Promise<any>((resolve, reject) => {
    const tx = db.transaction(['locations'], 'readonly');
    const store = tx.objectStore('locations');
    const req = store.get(locationId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!location || location.fetchedAt < now - CACHE_TTL) {
    return null;
  }

  // Читаем дневные прогнозы
  const daily = await new Promise<any[]>((resolve, reject) => {
    const tx = db.transaction(['daily'], 'readonly');
    const store = tx.objectStore('daily');
    const index = store.index('locationId');
    const req = index.getAll(locationId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  // Читаем почасовые данные
  const hourly = await new Promise<any[]>((resolve, reject) => {
    const tx = db.transaction(['hourly'], 'readonly');
    const store = tx.objectStore('hourly');
    const index = store.index('locationId');
    const req = index.getAll(locationId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  return {
    location: {
      id: location.id,
      name: location.name,
      country: location.country,
      timezone: location.timezone
    },
    forecasts: daily.map(d => ({
      forecastDate: d.date,
      tempMin: String(d.tempMin),
      tempMax: String(d.tempMax),
      precipitationMm: String(d.precipitationMm),
      windSpeedKmh: String(d.windSpeedKmh),
      windDirectionDeg: d.windDirectionDeg,
      humidityPct: d.humidityPct,
      weatherCode: d.weatherCode,
      moonPhaseName: d.moonPhaseName,
      kpIndex: String(d.kpIndex),
      kpLevel: d.kpLevel
    })),
    hourly: hourly.map(h => ({
      date: h.date,
      time: h.time,
      temp: h.temp,
      weatherCode: h.weatherCode,
      windSpeed: h.windSpeed,
      precipitation: h.precipitation
    }))
  };
}
