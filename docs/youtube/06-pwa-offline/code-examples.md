# Примеры кода для Эпизода 6: "PWA и офлайн-режим"

> Все примеры взяты из реального кода проекта

---

## ⚙️ main.tsx — точка входа PWA

```typescript
// client/src/main.tsx
import { registerSW } from 'virtual:pwa-register';
import { scheduleOfflineGC } from './services/offlineStore';
import { flushOnOnline } from './services/pendingActionsService';

const updateSW = registerSW({
  onOfflineReady() {
    console.info('[PWA] Оболочка доступна офлайн');
  },
  onNeedRefresh() {
    // Диспатчим событие → PwaUpdateToast показывает тост
    window.dispatchEvent(new CustomEvent('pwa:needRefresh', {
      detail: { updateSW: () => updateSW(true) }
    }));
  },
});

// GC при старте и при возврате вкладки — не чаще раза в сутки
scheduleOfflineGC();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') scheduleOfflineGC();
});

// Сброс офлайн-реакций при появлении сети (fallback для iOS)
flushOnOnline();
```

---

## ⚙️ sw.ts — Service Worker

```typescript
// client/src/sw.ts
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkOnly, NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

// Стратегия 1: Precache — статические ресурсы (JS, CSS, HTML)
// __WB_MANIFEST заполняется Workbox при сборке
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Стратегия 2: NetworkFirst — SPA навигация
// Сначала сеть (3 сек таймаут), fallback на precache index.html
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'pages',
      networkTimeoutSeconds: 3,
      plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
    }),
    { denylist: [/^\/api\//] } // API не кэшируем через SW
  )
);

// Стратегия 3: CacheFirst — изображения
registerRoute(
  /\.(?:png|jpe?g|webp|gif|svg)(?:[?#].*)?$/i,
  new CacheFirst({
    cacheName: 'news-images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 400,
        maxAgeSeconds: 7 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Стратегия 4: /api/weather/ — NetworkFirst с IDB fallback
registerRoute(
  /^\/api\/weather\//,
  async ({ request }) => {
    try {
      return await fetch(request); // сначала сеть
    } catch {
      const url = new URL(request.url);
      if (url.pathname.includes('/week')) {
        const locationId = url.searchParams.get('locationId');
        if (locationId) {
          const db = await openWeatherDB();
          const data = await getWeatherFromIDB(db, parseInt(locationId));
          if (data) {
            return new Response(JSON.stringify(data), {
              headers: {
                'Content-Type': 'application/json',
                'X-Cache': 'indexeddb', // клиент видит что данные из кэша
              }
            });
          }
        }
      }
      return new Response(
        JSON.stringify({ error: 'Offline and no cached data' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
);

// Стратегия 5: NetworkOnly — остальные API
registerRoute(/^\/api\//, new NetworkOnly());

// Prompt-стратегия: SW ждёт skipWaiting от клиента
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
```

---

## 💾 db.ts — Dexie схема NewsDb

```typescript
// client/src/services/db.ts
import Dexie, { type Table } from 'dexie';

export interface FeedSlice {
  key: string;
  articleIds: number[];
  lastSyncedAt: number;
}

export interface PendingAction {
  id?: number;
  type: 'react' | 'emotion';
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;
  status: 'pending' | 'failed';
}

export interface BookmarkRecord {
  articleId: number;
  savedAt: number;
  data: NewsArticleWithCluster;
}

class NewsDb extends Dexie {
  articles!: Table<NewsArticleWithCluster, number>;
  feedSlices!: Table<FeedSlice, string>;
  articleDetails!: Table<ArticleDetailRecord, number>;
  pendingActions!: Table<PendingAction, number>;
  readArticles!: Table<ReadArticle, number>;
  bookmarks!: Table<BookmarkRecord, number>;

  constructor() {
    super('news-aggregator-offline');
    this.version(1).stores({
      articles: 'id, publishedAt, region, category, sourceId, clusterId',
      feedSlices: 'key, lastSyncedAt',
      articleDetails: 'articleId, savedAt',
      pendingActions: '++id, status, createdAt',
    });
    this.version(2).stores({
      // ... все предыдущие таблицы
      readArticles: 'articleId, readAt',  // добавлена в v2
    });
    this.version(3).stores({
      // ... все предыдущие таблицы
      bookmarks: 'articleId, savedAt',    // добавлена в v3
    });
  }
}

export const db = new NewsDb();
```

---

## 💾 weatherDb.ts — Dexie схема WeatherDatabase

```typescript
// client/src/services/weatherDb.ts
class WeatherDatabase extends Dexie {
  locations!: Table<WeatherLocation, number>;
  daily!:     Table<DailyForecast, [number, string]>;
  hourly!:    Table<HourlyForecast, [number, string, string]>;

  constructor() {
    super('weather-cache');
    this.version(1).stores({
      locations: 'id, name, fetchedAt',
      daily:     '[locationId+date], locationId, fetchedAt',
      hourly:    '[locationId+date+time], locationId, date, fetchedAt',
    });
    // version(2), version(3): изменилась схема hourly
    // .upgrade() очищает hourly — данные перекачаются при следующем запросе
    this.version(3).stores({
      locations: 'id, name, fetchedAt',
      daily:     '[locationId+date], locationId, fetchedAt',
      hourly:    '[locationId+date+time], locationId, date, fetchedAt',
    }).upgrade(tx => tx.table('hourly').clear());
  }
}

export const weatherDb = new WeatherDatabase();
```

---

## 💾 offlineStore.ts — операции с IDB

```typescript
// client/src/services/offlineStore.ts

const MAX_ARTICLES = 3000;
const TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 дней
const GC_INTERVAL_MS = 24 * 60 * 60 * 1000; // раз в сутки

// Нормализует параметры фильтра в строковый ключ
export function buildFeedKey(params: Record<string, ...>): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false)
    .sort(([a], [b]) => a.localeCompare(b));
  return sorted.map(([k, v]) => `${k}=${v}`).join('&') || 'default';
}
// buildFeedKey({ region: 'russia', category: 'tech', page: null })
// → "category=tech&region=russia"

// Сохранить ленту
export async function saveFeedSlice(key: string, articles: NewsArticleWithCluster[]): Promise<void> {
  try {
    await db.articles.bulkPut(articles); // upsert
    await db.feedSlices.put({
      key,
      articleIds: articles.map(a => a.id),
      lastSyncedAt: Date.now(),
    });
  } catch { /* quota или IDB-ошибки — молча игнорируем */ }
}

// Загрузить ленту
export async function loadFeedSlice(key: string): Promise<NewsArticleWithCluster[] | null> {
  try {
    const slice = await db.feedSlices.get(key);
    if (!slice || !slice.articleIds.length) return null;
    const articles = await db.articles.bulkGet(slice.articleIds);
    const result = articles.filter((a): a is NewsArticleWithCluster => a !== undefined);
    return result.length > 0 ? result : null;
  } catch { return null; }
}

// GC: удаляет устаревшие данные
export async function runOfflineGC(): Promise<void> {
  const cutoff = new Date(Date.now() - TTL_MS).toISOString();
  await db.articles.where('publishedAt').below(cutoff).delete();
  await db.articleDetails.where('savedAt').below(Date.now() - TTL_MS).delete();
  await db.bookmarks.where('savedAt').below(Date.now() - TTL_MS).delete();

  const count = await db.articles.count();
  if (count > MAX_ARTICLES) {
    const toDelete = await db.articles
      .orderBy('publishedAt')
      .limit(count - MAX_ARTICLES)
      .primaryKeys();
    await db.articles.bulkDelete(toDelete as number[]);
  }

  // Чистим feedSlices с несуществующими статьями
  for (const slice of await db.feedSlices.toArray()) {
    const existing = await db.articles.bulkGet(slice.articleIds);
    const validIds = slice.articleIds.filter((_, i) => existing[i] !== undefined);
    if (validIds.length === 0) await db.feedSlices.delete(slice.key);
    else if (validIds.length !== slice.articleIds.length)
      await db.feedSlices.put({ ...slice, articleIds: validIds });
  }

  await purgeImageCache(); // Cache Storage 'news-images'
  localStorage.setItem('offline:gc:lastRun', String(Date.now()));
}

// Запуск не чаще раза в сутки
export function scheduleOfflineGC(): void {
  const last = Number(localStorage.getItem('offline:gc:lastRun') ?? 0);
  if (Date.now() - last >= GC_INTERVAL_MS) runOfflineGC();
}
```

---

## 🔔 push-service.ts — подписка на Web Push

```typescript
// client/src/services/push-service.ts

export async function subscribeToPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const publicKey = await getVapidPublicKey(); // GET /api/push/vapid-public-key
  if (!publicKey) return false;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return true; // уже подписан

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const subJson = subscription.toJSON() as any;

  // Привязываем к токену пользователя если авторизован
  const userToken = localStorage.getItem('userToken');
  if (userToken) {
    const v = await fetch('/api/my/validate?token=' + encodeURIComponent(userToken));
    const d = await v.json();
    if (d.valid && d.tokenId) subJson.tokenId = d.tokenId;
  }

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subJson),
  });
  return res.ok;
}

export async function getPushSubscriptionState():
  Promise<'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'subscribed' : 'unsubscribed';
}
```

---

## 📤 pendingActionsService.ts — офлайн-реакции

```typescript
// client/src/services/pendingActionsService.ts

const MAX_RETRIES = 3;

export async function enqueuePendingAction(
  type: PendingAction['type'],
  payload: ActionPayload,
): Promise<void> {
  await db.pendingActions.add({
    type,
    payload: payload as Record<string, unknown>,
    createdAt: Date.now(),
    retries: 0,
    status: 'pending',
  });
}

export async function flushPendingActions(): Promise<void> {
  const actions = await db.pendingActions.where('status').equals('pending').toArray();
  if (!actions.length) return;

  for (const action of actions) {
    const ok = await sendAction(action); // fetch /api/news/:id/react или /emotion
    if (ok) {
      await db.pendingActions.delete(action.id!);
    } else {
      const retries = action.retries + 1;
      if (retries >= MAX_RETRIES) {
        await db.pendingActions.update(action.id!, { status: 'failed', retries });
      } else {
        await db.pendingActions.update(action.id!, { retries });
      }
    }
  }
}

// Fallback для iOS — нет Background Sync API
export function flushOnOnline(): void {
  window.addEventListener('online', () => flushPendingActions());
  if (navigator.onLine) flushPendingActions(); // при старте
}
```

---

## 🔄 PwaUpdateToast.tsx — prompt-стратегия

```typescript
// client/src/components/common/PwaUpdateToast.tsx

export const PwaUpdateToast: React.FC = () => {
  const [updateSW, setUpdateSW] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const { updateSW } = (e as CustomEvent).detail;
      setUpdateSW(() => updateSW);
    };
    window.addEventListener('pwa:needRefresh', handler);
    return () => window.removeEventListener('pwa:needRefresh', handler);
  }, []);

  if (!updateSW) return null;

  return (
    <div className="pwa-update-toast" role="status" aria-live="polite">
      <span className="pwa-update-toast__text">Доступна новая версия</span>
      <button className="pwa-update-toast__btn" onClick={() => updateSW(true)} type="button">
        Обновить
      </button>
      <button className="pwa-update-toast__dismiss" onClick={() => setUpdateSW(null)}
        type="button" aria-label="Закрыть">
        ✕
      </button>
    </div>
  );
};
```

---

## 🪝 useServiceWorkerController.ts

```typescript
// client/src/hooks/useServiceWorkerController.ts

// Нужен для офлайн-погоды: SW должен управлять страницей
// чтобы перехватывать /api/weather/ запросы
export function useServiceWorkerController(): boolean | undefined {
  const [controlling, setControlling] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) { setControlling(false); return; }
    const sync = () => setControlling(!!navigator.serviceWorker.controller);
    sync();
    navigator.serviceWorker.addEventListener('controllerchange', sync);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', sync);
  }, []);

  return controlling;
  // undefined → проверяем
  // false     → SW не управляет (первый визит / hard reload)
  // true      → SW активен, офлайн-погода работает
}
```

---

## 🪝 usePushNotifications.ts

```typescript
// client/src/hooks/usePushNotifications.ts

type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading';

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('loading');

  useEffect(() => {
    getPushSubscriptionState().then(setState);
  }, []);

  const subscribe = useCallback(async () => {
    setState('loading');
    const ok = await subscribeToPush();
    setState(ok ? 'subscribed' : (Notification.permission === 'denied' ? 'denied' : 'unsubscribed'));
  }, []);

  const unsubscribe = useCallback(async () => {
    setState('loading');
    await unsubscribeFromPush();
    setState('unsubscribed');
  }, []);

  return { state, subscribe, unsubscribe };
}
```

---

*Все примеры соответствуют реальному production-коду проекта.*
