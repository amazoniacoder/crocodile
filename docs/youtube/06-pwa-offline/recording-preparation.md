# Подготовка к записи Эпизода 6: "PWA и офлайн-режим"

---

## 📋 Файлы для демонстрации

```
client/src/
├── main.tsx                              ← Блок 1: регистрация SW, GC, flushOnOnline
├── sw.ts                                 ← Блок 1: четыре стратегии + push handlers
├── services/
│   ├── db.ts                             ← Блок 2: NewsDb схема v1-v3
│   ├── weatherDb.ts                      ← Блок 2: WeatherDatabase схема v1-v3
│   ├── weatherCache.ts                   ← Блок 2: TTL онлайн/офлайн, saveWeekToCache
│   ├── offlineStore.ts                   ← Блок 2: buildFeedKey, saveFeedSlice, GC
│   ├── push-service.ts                   ← Блок 3: subscribeToPush, states
│   └── pendingActionsService.ts          ← Блок 4: enqueue, flush, retry
├── hooks/
│   ├── usePushNotifications.ts           ← Блок 3: PushState машина состояний
│   ├── useServiceWorkerController.ts     ← Блок 1: controlling boolean
│   └── useOnlineStatus.ts               ← Блок 4: navigator.onLine + events
└── components/common/
    └── PwaUpdateToast.tsx                ← Блок 1: prompt-стратегия
```

### Порядок открытия в VS Code
1. `main.tsx` — показать registerSW + scheduleOfflineGC + flushOnOnline
2. `sw.ts` — показать четыре стратегии + weather IDB fallback + push handlers
3. `db.ts` — показать NewsDb версионирование v1→v2→v3
4. `weatherDb.ts` — показать WeatherDatabase + составные ключи + .upgrade()
5. `offlineStore.ts` — показать buildFeedKey + saveFeedSlice + runOfflineGC
6. `push-service.ts` — показать subscribeToPush + привязка к userToken
7. `pendingActionsService.ts` — показать enqueue + flush + retry логика
8. `PwaUpdateToast.tsx` — показать prompt-стратегию

---

## 🎬 Подготовить перед записью

### Браузер
- [ ] Открыть приложение, дождаться активации SW
- [ ] DevTools → Application → Service Workers — убедиться "activated and is running"
- [ ] Открыть `/weather`, выбрать город — данные сохранятся в IDB
- [ ] Прокрутить ленту новостей — статьи сохранятся в IDB
- [ ] DevTools → Application → IndexedDB — проверить что данные есть

### VS Code
- [ ] Открыть все 8 файлов в отдельных вкладках
- [ ] Настроить шрифт 16px, отключить minimap
- [ ] Включить word wrap для длинных строк

### Терминал
- [ ] Приложение запущено: `npm run dev`
- [ ] ADMIN_TOKEN экспортирован: `export ADMIN_TOKEN=...`

---

## 🎯 Ключевые акценты

1. **injectManifest vs generateSW** — объяснить почему выбрали ручной SW
2. **Две IDB базы** — разные домены данных, разные TTL, независимое версионирование
3. **SW читает IDB напрямую** — для погоды, без участия клиентского кода, заголовок `X-Cache: indexeddb`
4. **weatherCache.ts: два TTL** — `CACHE_TTL = 1ч` (онлайн) vs `CACHE_TTL_OFFLINE = 24ч` (офлайн: любые данные лучше пустого экрана)
5. **GC на visibilitychange** — не только при старте, но и при возврате вкладки
6. **useServiceWorkerController** — undefined/false/true, нужен для офлайн-погоды
7. **iOS и Background Sync** — почему используем `window.online` вместо Background Sync API
8. **VAPID без FCM** — независимость от Google, стандарт W3C

---

## 🎬 Сценарии демонстрации в браузере

### Офлайн-режим новостей
```
1. DevTools → Network → Offline
2. Обновить страницу → приложение работает (precache)
3. Лента → статьи из IndexedDB
4. Поставить лайк → сохранится в pendingActions
5. Network → снять Offline → лайк отправится на сервер
```

### Офлайн-погода с X-Cache
```
1. Открыть /weather, выбрать город
2. DevTools → Network → Offline
3. Обновить /weather → данные отображаются
4. Network → найти /api/weather/week → Response Headers → X-Cache: indexeddb
```

### Prompt-стратегия
```
# В консоли браузера:
window.dispatchEvent(new CustomEvent('pwa:needRefresh', {
  detail: { updateSW: (r) => { console.log('reload:', r); if(r) location.reload(); } }
}))
# → появится PwaUpdateToast
```

---

## ⚙️ Настройки VS Code для записи

```json
{
  "editor.fontSize": 16,
  "editor.fontFamily": "JetBrains Mono",
  "editor.minimap.enabled": false,
  "editor.wordWrap": "on",
  "workbench.colorTheme": "Dark+ (default dark)"
}
```

---

## ✅ Чек-лист перед записью

- [ ] Приложение запущено и SW активен
- [ ] IDB содержит данные (статьи + погода)
- [ ] Все 8 файлов открыты в VS Code
- [ ] DevTools открыт на вкладке Application
- [ ] Микрофон проверен
- [ ] Уведомления системы отключены
- [ ] Мессенджеры закрыты

---

*Подготовка обеспечит точное соответствие демонстрации реальному коду.*
