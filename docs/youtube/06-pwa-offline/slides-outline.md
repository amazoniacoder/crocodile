# Слайды для Эпизода 6: "PWA и офлайн-режим"

> **Презентация:** 22-24 слайда для 22-25 минут эпизода

---

### Слайд 1: Заставка
```
NewsAggregator — PWA & Offline
Эпизод 6: "PWA и офлайн-режим"

⚙️  Service Worker: Workbox injectManifest
💾 IndexedDB: Dexie.js — 2 базы, 9 таблиц
🔔 Web Push: VAPID без FCM
📤 Pending Actions: офлайн-реакции с retry
🔄 Prompt-стратегия: обновление без сюрпризов
```

### Слайд 2: Что такое PWA
```
Progressive Web App

Обычный сайт:
  ❌ Нет интернета → белый экран
  ❌ Нет иконки на рабочем столе
  ❌ Нет push-уведомлений

PWA:
  ✅ Офлайн → статьи из IndexedDB
  ✅ Устанавливается как приложение
  ✅ Push-уведомления через браузер
  ✅ Счётчик непрочитанных на иконке (Badge API)

Ключевой компонент: Service Worker
```

---

## Блок 1: Service Worker (слайды 3-7)

### Слайд 3: Регистрация через vite-plugin-pwa
```
vite.config.ts
  VitePWA({ strategy: 'injectManifest', srcDir: 'src', filename: 'sw.ts' })
       │
       ▼
main.tsx
  registerSW({ onOfflineReady(), onNeedRefresh() })
       │
       ├─ onOfflineReady → console.info('[PWA] Оболочка доступна офлайн')
       └─ onNeedRefresh  → window.dispatchEvent('pwa:needRefresh')
                                    │
                                    ▼
                             PwaUpdateToast
                          показывает тост пользователю

injectManifest: SW пишем вручную, Workbox только вставляет precache-список
```

### Слайд 4: Четыре стратегии кэширования
```
Ресурс                  Стратегия       Кэш
─────────────────────────────────────────────────────
JS, CSS, HTML           Precache        workbox-precache
(self.__WB_MANIFEST)    (при установке) (автоматически)

SPA навигация           NetworkFirst    pages
(не /api/)              3 сек таймаут   fallback → index.html

Изображения             CacheFirst      news-images
*.png/jpg/webp/svg      7 дней TTL      max 400 записей

/api/* (кроме погоды)   NetworkOnly     —
                        (нет кэша)

/api/weather/*          NetworkFirst    → IDB fallback
                        + IDB fallback  при офлайне
```

### Слайд 5: Погода — особый случай
```
GET /api/weather/week?locationId=1

Онлайн:
  fetch(request) → ответ сервера ✅

Офлайн:
  fetch() throws → SW читает IndexedDB напрямую
       │
       ▼
  openWeatherDB() → IDB 'weather-cache'
  getWeatherFromIDB(db, locationId)
       │
       ├─ location.fetchedAt < now - 1ч → null (устарело)
       ├─ daily: index 'locationId' → getAll()
       └─ hourly: index 'locationId' → getAll()
       │
       ▼
  Response(JSON, { 'X-Cache': 'indexeddb' })

Клиент видит заголовок X-Cache: indexeddb
→ показывает индикатор "данные из кэша"
```

### Слайд 6: Prompt-стратегия обновления
```
Проблема автообновления:
  Пользователь читает статью
  SW обновляется автоматически
  Страница перезагружается → потеря контекста ❌

Prompt-стратегия:
  Новый SW установлен → ждёт skipWaiting
       │
       ▼
  onNeedRefresh() → CustomEvent 'pwa:needRefresh'
       │
       ▼
  PwaUpdateToast: "Доступна новая версия"
  [Обновить]  [✕]
       │
       ▼
  Пользователь нажал "Обновить"
  → updateSW(true) → SKIP_WAITING → reload ✅
```

### Слайд 7: useServiceWorkerController
```typescript
// Нужен для офлайн-погоды:
// SW должен быть активен и управлять страницей

export function useServiceWorkerController(): boolean | undefined {
  const [controlling, setControlling] = useState<boolean | undefined>();

  useEffect(() => {
    const sync = () => setControlling(!!navigator.serviceWorker.controller);
    sync();
    navigator.serviceWorker.addEventListener('controllerchange', sync);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', sync);
  }, []);

  return controlling;
}

// undefined → ещё не проверили
// false     → SW не управляет (первый визит, hard reload)
// true      → SW активен → офлайн-погода работает
```

---

## Блок 2: IndexedDB через Dexie.js (слайды 8-12)

### Слайд 8: Две базы IndexedDB
```
Почему две базы?

news-aggregator-offline (NewsDb)
  Назначение: офлайн-архив новостей
  Таблицы: 6
  Версия: 3
  TTL: 14 дней, лимит 3000 статей

weather-cache (WeatherDatabase)
  Назначение: кэш прогноза погоды
  Таблицы: 3
  Версия: 3 (с .upgrade() → clear())
  TTL: 1ч онлайн / 24ч офлайн / 7 дней max

Разделение: разные домены данных,
разные TTL, независимое версионирование
```

### Слайд 9: Схема NewsDb
```typescript
// news-aggregator-offline
class NewsDb extends Dexie {
  articles!:       Table<NewsArticleWithCluster, number>;
  feedSlices!:     Table<FeedSlice, string>;
  articleDetails!: Table<ArticleDetailRecord, number>;
  pendingActions!: Table<PendingAction, number>;
  readArticles!:   Table<ReadArticle, number>;
  bookmarks!:      Table<BookmarkRecord, number>;
}

// Версионирование — как SQL-миграции
version(1) → articles, feedSlices, articleDetails, pendingActions
version(2) → + readArticles
version(3) → + bookmarks

// Старые данные сохраняются при обновлении
```

### Слайд 10: Схема WeatherDatabase
```typescript
// weather-cache
class WeatherDatabase extends Dexie {
  locations!: Table<WeatherLocation, number>;
  daily!:     Table<DailyForecast, [number, string]>;    // [locationId, date]
  hourly!:    Table<HourlyForecast, [number, string, string]>; // [locationId, date, time]
}

// Составные ключи — уникальность по комбинации полей
daily:  '[locationId+date]'  → один прогноз на день на город
hourly: '[locationId+date+time]' → один прогноз на час

// version(2), version(3) — .upgrade(tx => tx.table('hourly').clear())
// При изменении схемы hourly — очищаем и перекачиваем
```

### Слайд 11: buildFeedKey — нормализация ключа
```typescript
buildFeedKey({ region: 'russia', category: 'tech', page: 1 })
→ "category=tech&page=1&region=russia"

buildFeedKey({ region: 'russia', category: null, source: '' })
→ "region=russia"  // null и '' отфильтрованы

buildFeedKey({})
→ "default"

// Зачем:
// Один и тот же фильтр → один ключ в feedSlices
// Порядок параметров не важен
// Пустые значения не влияют на ключ

// Аналогично для соцсетей:
buildSocialFeedKey('telegram', 'durov')
→ "social:telegram:durov"
```

### Слайд 12: Garbage Collector
```
Запуск: scheduleOfflineGC()
  → main.tsx: при старте + visibilitychange → visible
  → не чаще раза в сутки (localStorage 'offline:gc:lastRun')

Что чистит runOfflineGC():

1. articles.publishedAt < now - 14 дней → delete
2. articleDetails.savedAt < now - 14 дней → delete
3. bookmarks.savedAt < now - 14 дней → delete
4. articles.count() > 3000
   → orderBy('publishedAt').limit(excess) → bulkDelete
5. feedSlices → убираем несуществующие articleIds
   → если validIds.length === 0 → delete slice
6. Cache Storage 'news-images'
   → Date header < now - 14 дней → cache.delete(req)
```

---

## Блок 3: Web Push (слайды 13-16)

### Слайд 13: Архитектура VAPID
```
Почему VAPID, а не FCM?
  FCM: зависимость от Google, требует аккаунт
  VAPID: стандарт W3C, работает в любом браузере

Поток:
  1. Генерация ключей (один раз):
     npx web-push generate-vapid-keys
     → VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY

  2. Клиент подписывается:
     Notification.requestPermission() → 'granted'
     GET /api/push/vapid-public-key
     pushManager.subscribe({ applicationServerKey })
     POST /api/push/subscribe → endpoint в БД

  3. Сервер отправляет:
     webPushService.broadcast(payload)
     → web-push.sendNotification(subscription, payload)
     → Push Service (Google/Apple/Mozilla)
     → SW: 'push' event → showNotification()
```

### Слайд 14: Привязка к user token
```typescript
// Подписка привязывается к токену пользователя
const userToken = localStorage.getItem('userToken');
if (userToken) {
  const v = await fetch('/api/my/validate?token=' + encodeURIComponent(userToken));
  const d = await v.json();
  if (d.valid && d.tokenId) subJson.tokenId = d.tokenId;
}

await fetch('/api/push/subscribe', {
  method: 'POST',
  body: JSON.stringify(subJson), // { endpoint, keys, tokenId? }
});

// Зачем:
// Анонимный пользователь → получает общие уведомления
// Авторизованный → получает уведомления по подпискам
//   (только каналы на которые подписан)
```

### Слайд 15: usePushNotifications — состояния
```typescript
type PushState =
  | 'loading'       // проверяем
  | 'unsupported'   // браузер не поддерживает
  | 'denied'        // пользователь запретил
  | 'unsubscribed'  // можно подписаться
  | 'subscribed'    // активная подписка

// Переходы:
// loading → unsupported (нет SW или PushManager)
// loading → denied (Notification.permission === 'denied')
// loading → subscribed / unsubscribed (проверка pushManager)
// unsubscribed → [subscribe()] → subscribed
// subscribed → [unsubscribe()] → unsubscribed

// DELETE /api/push/subscribe { endpoint } → отписка на сервере
// subscription.unsubscribe() → отписка в браузере
```

### Слайд 16: SW — обработка push и клик
```typescript
// Получение push
self.addEventListener('push', (event) => {
  const payload = event.data?.json() ?? { title: 'Новые статьи' };
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: { url: payload.url ?? '/' },
    })
  );
});

// Клик по уведомлению
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        const existing = clients.find(c => c.url.includes(self.location.origin));
        if (existing) return existing.focus(); // фокус на открытую вкладку
        return self.clients.openWindow(event.notification.data.url);
      })
  );
});
```

---

## Блок 4: Pending Actions (слайды 17-18)

### Слайд 17: Проблема офлайн-реакций
```
Пользователь поставил лайк офлайн:

Без Pending Actions:
  fetch('/api/news/123/react') → NetworkError
  Лайк потерян ❌

С Pending Actions:
  enqueuePendingAction('react', { articleId: 123, type: 'like' })
  → сохранить в IDB pendingActions { status: 'pending' }

  При появлении сети (событие 'online'):
  flushPendingActions()
  → отправить на сервер
  → ok: delete из IDB
  → fail: retries++, при retries >= 3 → status: 'failed'

iOS: нет Background Sync API
→ используем window.addEventListener('online', flush)
```

### Слайд 18: Retry логика
```
pendingActions таблица:
  { id, type, payload, createdAt, retries, status }

flushPendingActions():
  where('status').equals('pending') → все ожидающие

  for each action:
    sendAction(action) → fetch /api/news/:id/react
                      → fetch /api/news/:id/emotion

    ok  → db.pendingActions.delete(action.id)
    err → retries + 1
          retries >= MAX_RETRIES(3)
            → status: 'failed' (не пытаемся снова)
          retries < 3
            → обновляем retries, попробуем при следующем 'online'

flushOnOnline():
  window.addEventListener('online', flushPendingActions)
  navigator.onLine → flushPendingActions() // при старте
```

---

## Заключение (слайды 19-21)

### Слайд 19: Архитектура целиком
```
main.tsx
  registerSW() → onNeedRefresh → PwaUpdateToast
  scheduleOfflineGC() + visibilitychange
  flushOnOnline()

sw.ts
  precacheAndRoute(__WB_MANIFEST)
  NavigationRoute → NetworkFirst (pages)
  /images/ → CacheFirst (news-images, 7 дней)
  /api/weather/ → NetworkFirst + IDB fallback
  /api/ → NetworkOnly
  'push' → showNotification()
  'notificationclick' → focus/openWindow
  'message' SKIP_WAITING → skipWaiting()

IndexedDB
  news-aggregator-offline (NewsDb v3, 6 таблиц)
  weather-cache (WeatherDatabase v3, 3 таблицы)
```

### Слайд 20: Ключевые решения
```
✅ injectManifest вместо generateSW
   → полный контроль над SW, кастомные роуты

✅ Две отдельные IDB базы
   → разные TTL и схемы, независимое версионирование

✅ SW читает IDB напрямую для погоды
   → офлайн без участия клиентского кода

✅ VAPID вместо FCM
   → нет зависимости от Google, стандарт W3C

✅ Prompt-стратегия обновления
   → пользователь контролирует момент обновления

✅ window.online вместо Background Sync
   → работает на iOS Safari
```

### Слайд 21: Реальные метрики
```
Precache: JS + CSS + HTML (при установке SW)
CacheFirst изображения: 7 дней, max 400 записей
NetworkFirst таймаут: 3 секунды
IDB статьи: 14 дней TTL, лимит 3000
IDB погода онлайн TTL: 1 час
IDB погода офлайн TTL: 24 часа (любые данные лучше пустого экрана)
IDB погода max age: 7 дней
GC: раз в сутки (main.tsx + visibilitychange)
Pending Actions MAX_RETRIES: 3
```

### Слайд 22: Анонс Эпизода 7
```
🎬 Эпизод 7: "Безопасность enterprise-уровня"

🛡️ Собственная CAPTCHA — без Google reCAPTCHA
🔒 DDoS защита — rate limiting + Nginx
🚫 Fail2Ban — автоматическая блокировка
🔐 SSL мониторинг — алерты за 30 дней до истечения
📊 AlertManager — 17 правил, единая система

Подписывайтесь! 👍
```

---

## 🎨 Дизайн-система

- **Service Worker / Workbox:** `#6366f1` (индиго)
- **IndexedDB / Dexie:** `#0ea5e9` (голубой)
- **Web Push / VAPID:** `#f59e0b` (янтарный)
- **Pending Actions:** `#22c55e` (зелёный)
- **Офлайн / fallback:** `#6b7280` (серый)
- **Ошибка / failed:** `#ef4444` (красный)

---

*Слайды основаны на реальном production-коде проекта.*
