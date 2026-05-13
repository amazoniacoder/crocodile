# Эпизод 6: "PWA и офлайн-режим"

> **Длительность:** 22-25 минут
> **Цель:** Показать реальную реализацию PWA — Service Worker, IndexedDB, Web Push
> **Аудитория:** Frontend разработчики, fullstack

---

## 🎯 Цели эпизода

- Показать архитектуру Service Worker с Workbox (injectManifest)
- Разобрать IndexedDB через Dexie.js — схема, версионирование, GC
- Объяснить стратегии кэширования: NetworkFirst, CacheFirst, NetworkOnly
- Показать Web Push уведомления через VAPID
- Разобрать Pending Actions — офлайн-реакции с синхронизацией

---

## 📝 Сценарий эпизода

### 🎬 Интро (2 минуты)

**[Показать демо офлайн-режима в браузере]**

**Ведущий:**
> Привет! В шестом эпизоде — PWA и офлайн-режим. Смотрите: отключаю интернет в DevTools — приложение продолжает работать. Статьи загружаются из IndexedDB. Включаю сеть — реакции которые я поставил офлайн автоматически синхронизируются.

**[Показать структуру эпизода]**

> Разберём:
> - Service Worker с Workbox — три стратегии кэширования
> - Dexie.js — IndexedDB с версионированием и GC
> - Pending Actions — офлайн-реакции
> - Web Push — VAPID, подписка, уведомления
> - PwaUpdateToast — prompt-стратегия обновления

---

### ⚙️ Блок 1: Service Worker (6 минут)

#### Подблок 1.1: Регистрация через vite-plugin-pwa

**[Открыть client/src/main.tsx]**

```typescript
// main.tsx — регистрация SW через virtual:pwa-register
import { registerSW } from 'virtual:pwa-register';

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
```

**Ведущий:**
> `virtual:pwa-register` — это виртуальный модуль от vite-plugin-pwa. Он регистрирует SW и предоставляет колбэки. `onNeedRefresh` — prompt-стратегия: новый SW ждёт разрешения пользователя, не обновляется автоматически.

#### Подблок 1.2: Три стратегии кэширования

**[Открыть client/src/sw.ts]**

```typescript
// Стратегия 1: precache — статические ресурсы (JS, CSS, HTML)
precacheAndRoute(self.__WB_MANIFEST); // список файлов от Workbox
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
// Сначала кэш, сеть только если нет
registerRoute(
  /\.(?:png|jpe?g|webp|gif|svg)(?:[?#].*)?$/i,
  new CacheFirst({
    cacheName: 'news-images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 400,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 дней
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// API — только сеть (кроме погоды)
registerRoute(/^\/api\//, new NetworkOnly());
```

#### Подблок 1.3: Специальный роут для погоды

```typescript
// /api/weather/ — NetworkFirst с IDB fallback
registerRoute(
  /^\/api\/weather\//,
  async ({ request }) => {
    try {
      return await fetch(request); // сначала сеть
    } catch {
      // Офлайн → читаем из IndexedDB напрямую в SW
      if (url.pathname.includes('/week')) {
        const db = await openWeatherDB();
        const data = await getWeatherFromIDB(db, locationId);
        if (data) {
          return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json', 'X-Cache': 'indexeddb' }
          });
        }
      }
      return new Response(
        JSON.stringify({ error: 'Offline and no cached data' }),
        { status: 503 }
      );
    }
  }
);
```

**Ведущий:**
> Погода — особый случай. SW читает IndexedDB напрямую, без участия клиентского кода. Заголовок `X-Cache: indexeddb` сигнализирует клиенту что данные из кэша.

#### Подблок 1.4: useServiceWorkerController

**[Открыть client/src/hooks/useServiceWorkerController.ts]**

```typescript
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
  // undefined → ещё проверяем
  // false     → SW не управляет (первый визит / hard reload)
  // true      → SW активен, офлайн-погода работает
}
```

**Ведущий:**
> Три состояния: `undefined` — ещё не знаем, `false` — SW не взял контроль (например, после hard reload), `true` — SW активен. Компонент погоды использует этот хук чтобы решить — показывать офлайн-индикатор или нет.

#### Подблок 1.5: Prompt-стратегия обновления

```typescript
// sw.ts — ждём skipWaiting от клиента
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// PwaUpdateToast.tsx — показываем тост пользователю
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

### 💾 Блок 2: IndexedDB через Dexie.js (6 минут)

#### Подблок 2.1: Две базы IndexedDB

**Ведущий:**
> В проекте две отдельные IDB базы. Почему не одна? Разные домены данных, разные TTL, независимое версионирование.

**[Открыть client/src/services/db.ts]**

```typescript
// База 1: news-aggregator-offline — офлайн-архив новостей
class NewsDb extends Dexie {
  articles!: Table<NewsArticleWithCluster, number>;
  feedSlices!: Table<FeedSlice, string>;
  articleDetails!: Table<ArticleDetailRecord, number>;
  pendingActions!: Table<PendingAction, number>;
  readArticles!: Table<ReadArticle, number>;
  bookmarks!: Table<BookmarkRecord, number>;

  constructor() {
    super('news-aggregator-offline');
    // Версионирование — добавляем таблицы без потери данных
    this.version(1).stores({
      articles: 'id, publishedAt, region, category, sourceId, clusterId',
      feedSlices: 'key, lastSyncedAt',
      articleDetails: 'articleId, savedAt',
      pendingActions: '++id, status, createdAt',
    });
    this.version(2).stores({ /* ... */ readArticles: 'articleId, readAt' });
    this.version(3).stores({ /* ... */ bookmarks: 'articleId, savedAt' });
  }
}
export const db = new NewsDb();
```

**[Открыть client/src/services/weatherDb.ts]**

```typescript
// База 2: weather-cache — кэш прогноза погоды
class WeatherDatabase extends Dexie {
  locations!: Table<WeatherLocation, number>;
  daily!:     Table<DailyForecast, [number, string]>;           // составной ключ [locationId, date]
  hourly!:    Table<HourlyForecast, [number, string, string]>;  // [locationId, date, time]

  constructor() {
    super('weather-cache');
    this.version(1).stores({
      locations: 'id, name, fetchedAt',
      daily:     '[locationId+date], locationId, fetchedAt',
      hourly:    '[locationId+date+time], locationId, date, fetchedAt',
    });
    // version(2), version(3): изменилась схема hourly
    // .upgrade() очищает hourly — данные перекачаются при следующем запросе
    this.version(3).stores({ /* ... */ })
      .upgrade(tx => tx.table('hourly').clear());
  }
}
export const weatherDb = new WeatherDatabase();
```

**Ведущий:**
> NewsDb — версионирование без потери данных. WeatherDatabase — при изменении схемы hourly явно очищаем таблицу через `.upgrade()`. Данные погоды перекачаются при следующем запросе — это нормально, они не критичны.

#### Подблок 2.2: offlineStore — операции с IDB

**[Открыть client/src/services/offlineStore.ts]**

```typescript
const MAX_ARTICLES = 3000;
const TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 дней

// Ключ для ленты — нормализованные параметры фильтра
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
    await db.articles.bulkPut(articles);       // upsert статей
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

// Офлайн-поиск по скачанным статьям
export async function searchOffline(query: string, limit = 50): Promise<NewsArticleWithCluster[]> {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return db.articles
    .filter(a =>
      a.title.toLowerCase().includes(q) ||
      (a.description ?? '').toLowerCase().includes(q)
    )
    .limit(limit)
    .toArray();
}
```

#### Подблок 2.3: Garbage Collector

```typescript
const GC_INTERVAL_MS = 24 * 60 * 60 * 1000; // раз в сутки
const GC_LAST_RUN_KEY = 'offline:gc:lastRun';

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

  for (const slice of await db.feedSlices.toArray()) {
    const existing = await db.articles.bulkGet(slice.articleIds);
    const validIds = slice.articleIds.filter((_, i) => existing[i] !== undefined);
    if (validIds.length === 0) await db.feedSlices.delete(slice.key);
    else if (validIds.length !== slice.articleIds.length)
      await db.feedSlices.put({ ...slice, articleIds: validIds });
  }

  await purgeImageCache(); // Cache Storage 'news-images', Date header < now-14d
  localStorage.setItem(GC_LAST_RUN_KEY, String(Date.now()));
}

// Запуск не чаще раза в сутки
export function scheduleOfflineGC(): void {
  const last = Number(localStorage.getItem(GC_LAST_RUN_KEY) ?? 0);
  if (Date.now() - last >= GC_INTERVAL_MS) runOfflineGC();
}
```

**Ведущий:**
> GC запускается в двух местах в `main.tsx`: при старте и при `visibilitychange → visible`. Пользователь вернулся на вкладку — хороший момент для фоновой очистки.

---

### 🔔 Блок 3: Web Push уведомления (5 минут)

#### Подблок 3.1: Архитектура VAPID

**[Показать слайд с потоком]**

```
Сервер генерирует VAPID ключи (один раз):
  npx web-push generate-vapid-keys
  → VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY

Клиент подписывается:
  1. Notification.requestPermission() → 'granted'
  2. GET /api/push/vapid-public-key → publicKey
  3. pushManager.subscribe({ applicationServerKey: publicKey })
  4. POST /api/push/subscribe → сохраняем endpoint в БД

Сервер отправляет:
  webPushService.broadcast({ title, body, url })
  → web-push.sendNotification(subscription, payload)
  → Push Service (Google/Apple/Mozilla)
  → Service Worker: 'push' event
  → showNotification()
```

#### Подблок 3.2: Клиентская подписка

**[Открыть client/src/services/push-service.ts]**

```typescript
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
```

#### Подблок 3.3: Service Worker — обработка push

```typescript
// sw.ts
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Новые статьи', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Новые статьи', {
      body: payload.body ?? '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: { url: payload.url ?? '/' },
    })
  );
});

// Клик по уведомлению — открыть/сфокусировать вкладку
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        const existing = clients.find(c => c.url.includes(self.location.origin));
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      })
  );
});
```

---

### 📤 Блок 4: Pending Actions (3 минуты)

**[Открыть client/src/services/pendingActionsService.ts]**

**Ведущий:**
> Пользователь поставил лайк офлайн. Как это сохранить?

```typescript
// Офлайн: сохраняем в IDB
export async function enqueuePendingAction(type, payload): Promise<void> {
  await db.pendingActions.add({
    type,       // 'react' | 'emotion'
    payload,    // { articleId, type: 'like' }
    createdAt: Date.now(),
    retries: 0,
    status: 'pending',
  });
}

// При появлении сети — отправляем на сервер
export async function flushPendingActions(): Promise<void> {
  const actions = await db.pendingActions
    .where('status').equals('pending').toArray();

  for (const action of actions) {
    const ok = await sendAction(action);
    if (ok) {
      await db.pendingActions.delete(action.id);
    } else {
      const retries = action.retries + 1;
      if (retries >= MAX_RETRIES) {
        await db.pendingActions.update(action.id, { status: 'failed', retries });
      } else {
        await db.pendingActions.update(action.id, { retries });
      }
    }
  }
}

// Регистрируем flush при событии online
export function flushOnOnline(): void {
  window.addEventListener('online', () => flushPendingActions());
  if (navigator.onLine) flushPendingActions(); // при старте
}
```

**Ведущий:**
> MAX_RETRIES = 3. После трёх неудач — статус `failed`, не пытаемся снова. iOS не поддерживает Background Sync — используем событие `online` как fallback.

---

### 🎓 Заключение (1 минута)

**Ведущий:**
> Итоги PWA:

1. **Service Worker** — precache + NetworkFirst (страницы) + CacheFirst (изображения) + NetworkOnly (API)
2. **Погода** — SW читает IDB напрямую, заголовок `X-Cache: indexeddb`
3. **Две IDB базы** — NewsDb (6 таблиц, 14 дней) + WeatherDatabase (3 таблицы, 1ч/24ч/7д)
4. **GC** — раз в сутки, при старте + visibilitychange
5. **Pending Actions** — офлайн-реакции, MAX_RETRIES=3, `window.online` для iOS
6. **Web Push** — VAPID без FCM, привязка к user token
7. **Prompt-стратегия** — пользователь контролирует момент обновления SW

> В следующем эпизоде — безопасность enterprise-уровня: CAPTCHA, DDoS защита, Fail2Ban, SSL мониторинг.

---

## 🎥 Технические требования

### Файлы для демонстрации
```
client/src/
├── main.tsx                              ← регистрация SW, GC, flushOnOnline
├── sw.ts                                 ← четыре стратегии + push handlers
├── services/
│   ├── db.ts                             ← NewsDb схема v1-v3
│   ├── weatherDb.ts                      ← WeatherDatabase схема v1-v3
│   ├── weatherCache.ts                   ← TTL онлайн/офлайн, saveWeekToCache
│   ├── offlineStore.ts                   ← buildFeedKey, saveFeedSlice, GC
│   ├── push-service.ts                   ← subscribeToPush, states
│   └── pendingActionsService.ts          ← enqueue, flush, retry
├── hooks/
│   ├── usePushNotifications.ts           ← PushState машина состояний
│   ├── useServiceWorkerController.ts     ← controlling boolean
│   └── useOnlineStatus.ts               ← navigator.onLine + events
└── components/common/
    └── PwaUpdateToast.tsx                ← prompt-стратегия
```

### Демо в браузере
- DevTools → Application → Service Workers — показать статус SW
- DevTools → Application → IndexedDB — показать `news-aggregator-offline` и `weather-cache`
- DevTools → Network → Offline — показать офлайн-режим
- DevTools → Network → найти `/api/weather/week` → Response Headers → `X-Cache: indexeddb`
- DevTools → Application → Cache Storage — показать precache и news-images
