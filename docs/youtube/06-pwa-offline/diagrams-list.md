# Диаграммы для Эпизода 6: "PWA и офлайн-режим"

---

## 📊 Диаграмма 1: Общая архитектура PWA

```
Браузер
  │
  ├─ main.tsx
  │    ├─ registerSW() → virtual:pwa-register
  │    │    ├─ onOfflineReady → console.info
  │    │    └─ onNeedRefresh → CustomEvent 'pwa:needRefresh'
  │    │                              │
  │    │                              ▼
  │    │                       PwaUpdateToast
  │    │                    "Доступна новая версия"
  │    │
  │    ├─ scheduleOfflineGC() — при старте
  │    ├─ visibilitychange → scheduleOfflineGC()
  │    └─ flushOnOnline() — регистрирует flush при 'online'
  │
  └─ sw.ts (Service Worker)
       ├─ precacheAndRoute(__WB_MANIFEST)
       ├─ NavigationRoute → NetworkFirst (pages)
       ├─ /images/ → CacheFirst (news-images)
       ├─ /api/weather/ → NetworkFirst + IDB fallback
       ├─ /api/ → NetworkOnly
       ├─ 'push' → showNotification()
       ├─ 'notificationclick' → focus/openWindow
       └─ 'message' SKIP_WAITING → skipWaiting()
```

---

## 📊 Диаграмма 2: Стратегии кэширования

```
HTTP запрос
     │
     ├─ /index.html, /assets/*.js, /assets/*.css
     │    └─ Precache (self.__WB_MANIFEST)
     │         Установлен при активации SW
     │         Версионирован хэшем файла
     │
     ├─ GET /news, /weather, /youtube (навигация)
     │    └─ NetworkFirst (cacheName: 'pages')
     │         Сеть → 3 сек таймаут
     │         Офлайн → precache index.html (SPA fallback)
     │
     ├─ *.png, *.jpg, *.webp, *.svg
     │    └─ CacheFirst (cacheName: 'news-images')
     │         Кэш → сеть только если нет
     │         TTL: 7 дней, max 400 записей
     │         purgeOnQuotaError: true
     │
     ├─ /api/weather/week?locationId=N
     │    └─ NetworkFirst + IDB fallback
     │         Сеть → ответ сервера
     │         Офлайн → openWeatherDB() → getWeatherFromIDB()
     │                  TTL проверка: 1 час
     │                  Ответ: { 'X-Cache': 'indexeddb' }
     │
     └─ /api/* (остальные)
          └─ NetworkOnly
               Нет кэша, нет fallback
               Офлайн → NetworkError (обрабатывается клиентом)
```

---

## 📊 Диаграмма 3: IndexedDB — две базы

```
┌─────────────────────────────────────────────────────────┐
│              news-aggregator-offline (NewsDb v3)        │
├──────────────────┬──────────────────────────────────────┤
│ articles         │ id, publishedAt, region, category,   │
│                  │ sourceId, clusterId                   │
│                  │ TTL: 14 дней, лимит: 3000            │
├──────────────────┼──────────────────────────────────────┤
│ feedSlices       │ key (buildFeedKey), articleIds[],    │
│                  │ lastSyncedAt                          │
├──────────────────┼──────────────────────────────────────┤
│ articleDetails   │ articleId, data, savedAt             │
│                  │ TTL: 14 дней                         │
├──────────────────┼──────────────────────────────────────┤
│ pendingActions   │ ++id, type, payload, retries, status │
├──────────────────┼──────────────────────────────────────┤
│ readArticles     │ articleId, readAt                    │
├──────────────────┼──────────────────────────────────────┤
│ bookmarks        │ articleId, savedAt, data             │
│                  │ TTL: 14 дней                         │
└──────────────────┴──────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              weather-cache (WeatherDatabase v3)         │
├──────────────────┬──────────────────────────────────────┤
│ locations        │ id, name, country, timezone,         │
│                  │ fetchedAt                             │
│                  │ TTL: 1ч (онлайн) / 24ч (офлайн)     │
├──────────────────┼──────────────────────────────────────┤
│ daily            │ [locationId+date] составной ключ     │
│                  │ tempMin/Max, precipitation, wind...  │
│                  │ moonPhaseName, kpIndex, kpLevel      │
├──────────────────┼──────────────────────────────────────┤
│ hourly           │ [locationId+date+time] составной ключ│
│                  │ temp, weatherCode, windSpeed...      │
│                  │ max age: 7 дней                      │
└──────────────────┴──────────────────────────────────────┘
```

---

## 📊 Диаграмма 4: Garbage Collector

```
Триггеры запуска scheduleOfflineGC():
  main.tsx: при старте приложения
  main.tsx: document.visibilitychange → 'visible'
  Условие: Date.now() - lastRun >= 24 часа

runOfflineGC() — порядок операций:

  1. articles WHERE publishedAt < now-14d → DELETE
     (устаревшие статьи)

  2. articleDetails WHERE savedAt < now-14d → DELETE
     bookmarks WHERE savedAt < now-14d → DELETE

  3. articles.count() > 3000?
     → orderBy('publishedAt').limit(excess).primaryKeys()
     → bulkDelete (самые старые)

  4. feedSlices — проверка целостности:
     for each slice:
       bulkGet(articleIds) → existing[]
       validIds = filter(_, i) => existing[i] !== undefined
       validIds.length === 0 → delete slice
       validIds.length < articleIds.length → update slice

  5. Cache Storage 'news-images':
     keys() → match() → Date header < now-14d → delete

  6. localStorage.setItem('offline:gc:lastRun', now)
```

---

## 📊 Диаграмма 5: Web Push — полный поток

```
Подготовка (один раз):
  npx web-push generate-vapid-keys
  → VAPID_PUBLIC_KEY (публичный, отдаётся клиенту)
  → VAPID_PRIVATE_KEY (секретный, только на сервере)

Подписка клиента:
  subscribeToPush()
       │
       ├─ Notification.requestPermission() → 'granted'
       ├─ GET /api/push/vapid-public-key → publicKey
       ├─ reg.pushManager.getSubscription() → уже есть? return true
       ├─ pushManager.subscribe({ applicationServerKey })
       │    → Push Service выдаёт endpoint
       ├─ localStorage 'userToken' → validate → tokenId?
       └─ POST /api/push/subscribe { endpoint, keys, tokenId? }
              → сохранить в push_subscriptions

Отправка с сервера:
  webPushService.broadcast({ title, body, url })
       │
       └─ for each subscription:
            web-push.sendNotification(sub, JSON.stringify(payload))
            → Push Service (Google FCM / Apple APNs / Mozilla)
            → SW 'push' event
            → showNotification(title, { body, icon, badge, data })

Клик по уведомлению:
  SW 'notificationclick'
  → clients.matchAll() → existing? focus() : openWindow(url)
```

---

## 📊 Диаграмма 6: Pending Actions — жизненный цикл

```
Пользователь офлайн:
  Нажал лайк / эмодзи
       │
       ▼
  enqueuePendingAction('react', { articleId, type: 'like' })
  → db.pendingActions.add({ status: 'pending', retries: 0 })

Появилась сеть (событие 'online'):
  flushPendingActions()
       │
       ▼
  pendingActions WHERE status = 'pending' → toArray()
       │
       ├─ for each action:
       │    sendAction(action)
       │         ├─ type='react'   → POST /api/news/:id/react
       │         └─ type='emotion' → POST /api/news/:id/emotion
       │              x-browser-id: getBrowserId()
       │
       ├─ ok  → db.pendingActions.delete(id) ✅
       │
       └─ err → retries + 1
                 retries >= 3 → status: 'failed' (финальный)
                 retries < 3  → оставляем, попробуем снова

Примечание: iOS Safari не поддерживает Background Sync API
→ используем window.addEventListener('online', flush)
   как надёжный кроссбраузерный fallback
```

---

## 📊 Диаграмма 7: Prompt-стратегия обновления SW

```
Новая версия приложения задеплоена:

  Браузер обнаруживает новый SW
       │
       ▼
  Новый SW устанавливается (install)
  Ждёт: старый SW ещё активен
       │
       ▼
  vite-plugin-pwa: onNeedRefresh()
  → window.dispatchEvent(CustomEvent 'pwa:needRefresh', {
      detail: { updateSW: () => updateSW(true) }
    })
       │
       ▼
  PwaUpdateToast слушает 'pwa:needRefresh'
  → setUpdateSW(() => updateSW)
  → рендерит тост: "Доступна новая версия"
       │
       ├─ [Обновить] → updateSW(true)
       │    → postMessage({ type: 'SKIP_WAITING' }) → SW
       │    → sw.ts: self.skipWaiting()
       │    → новый SW активируется → reload страницы
       │
       └─ [✕] → setUpdateSW(null) → тост скрыт
                 Пользователь обновится при следующем визите
```

---

*Диаграммы основаны на реальной реализации проекта.*
