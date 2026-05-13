# Сценарии демонстрации для Эпизода 6: "PWA и офлайн-режим"

> Все сценарии проверены на реальном коде проекта

---

## 🎬 Демо 1: Офлайн-режим новостей

### Подготовка
- [ ] Открыть приложение, дождаться загрузки ленты
- [ ] Убедиться что SW активен: DevTools → Application → Service Workers → статус "activated and is running"
- [ ] Прокрутить ленту — статьи сохранятся в IDB

### Сценарий
1. **DevTools → Network → выбрать "Offline"**
2. Обновить страницу — приложение загружается (precache)
3. Открыть ленту — статьи отображаются из IndexedDB
4. Показать в DevTools → Application → IndexedDB → `news-aggregator-offline` → `articles`
5. Поставить лайк на статью — реакция сохраняется локально
6. **Network → снять "Offline"**
7. Показать в консоли: `[pendingActions] flush → отправлено`
8. Проверить в DevTools → IndexedDB → `pendingActions` — таблица пуста

### Что показать в DevTools
```
Application → Service Workers
  Status: activated and is running
  Source: sw.ts (injectManifest)

Application → IndexedDB → news-aggregator-offline
  articles: N записей
  feedSlices: ключи вида "category=tech&region=russia"
  pendingActions: пусто (после flush)

Application → Cache Storage
  workbox-precache-v2-...: JS, CSS, HTML
  pages: index.html
  news-images: изображения статей
```

---

## 🎬 Демо 2: Офлайн-погода

### Подготовка
- [ ] Открыть `/weather`, выбрать город, дождаться загрузки
- [ ] Данные сохранятся в `weather-cache` IDB

### Сценарий
1. Открыть DevTools → Application → IndexedDB → `weather-cache`
2. Показать таблицы: `locations`, `daily` (7 записей), `hourly` (168 записей)
3. **Network → "Offline"**
4. Обновить страницу `/weather`
5. Погода отображается — данные из IDB
6. Открыть DevTools → Network → найти запрос `/api/weather/week`
7. Показать заголовок ответа: **`X-Cache: indexeddb`**
8. Объяснить: SW перехватил запрос и вернул данные из IDB напрямую

### Ключевой момент
```
Запрос: GET /api/weather/week?locationId=1
Ответ от SW (офлайн):
  Status: 200
  X-Cache: indexeddb
  Content-Type: application/json

Клиент получает данные как обычно —
не знает что они из кэша (кроме заголовка)
```

---

## 🎬 Демо 3: Prompt-стратегия обновления

### Подготовка
- [ ] Приложение запущено с активным SW
- [ ] Симулировать новый SW через DevTools

### Сценарий
1. DevTools → Application → Service Workers
2. Нажать **"Skip waiting"** (симулирует новую версию)
3. Показать появление `PwaUpdateToast` в правом нижнем углу
4. Нажать **"Обновить"** — страница перезагружается с новым SW
5. Нажать **"✕"** — тост скрывается, SW ждёт следующего визита

### Альтернативный способ (через консоль)
```javascript
// Симулировать событие в консоли браузера
window.dispatchEvent(new CustomEvent('pwa:needRefresh', {
  detail: {
    updateSW: (reload) => {
      console.log('[Demo] updateSW called, reload:', reload);
      if (reload) location.reload();
    }
  }
}));
```

---

## 🎬 Демо 4: Web Push уведомления

### Подготовка
- [ ] VAPID ключи настроены в `.env`
- [ ] Приложение запущено на HTTPS (или localhost)

### Сценарий
1. Открыть страницу `/my` (личный кабинет)
2. Нажать кнопку **"Включить уведомления"**
3. Браузер запрашивает разрешение → нажать "Разрешить"
4. Показать в DevTools → Application → Push Messaging → подписка активна
5. Отправить тестовое уведомление через admin API:
```bash
curl -X POST http://localhost:5000/api/admin/push/test \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Тест", "body": "Тестовое уведомление", "url": "/"}'
```
6. Уведомление появляется в системе
7. Клик по уведомлению → открывается/фокусируется вкладка приложения

### Показать состояния usePushNotifications
```
DevTools → Application → Notifications
  Permission: granted

DevTools → Application → Service Workers → Push
  Показать последний push payload
```

---

## 🎬 Демо 5: IndexedDB — версионирование и GC

### Сценарий версионирования
1. DevTools → Application → IndexedDB → `news-aggregator-offline`
2. Показать версию базы: **3**
3. Объяснить: версия 1 → articles/feedSlices/articleDetails/pendingActions
4. Версия 2 добавила readArticles, версия 3 добавила bookmarks
5. При обновлении версии старые данные сохраняются

### Сценарий GC
```javascript
// Запустить GC вручную в консоли браузера
import('/src/services/offlineStore.js').then(m => m.runOfflineGC());

// Или через localStorage — сбросить время последнего запуска
localStorage.removeItem('offline:gc:lastRun');
// Перезагрузить страницу → GC запустится
```

### Показать buildFeedKey
```javascript
// В консоли браузера
// Показать нормализацию ключа
const params = { region: 'russia', category: 'tech', page: null, source: '' };
// Ожидаемый результат: "category=tech&region=russia"
```

---

## 🎬 Демо 6: useServiceWorkerController

### Сценарий
1. Открыть приложение в обычном режиме
2. DevTools → Application → Service Workers → статус "activated"
3. Показать в React DevTools: `useServiceWorkerController` → `true`
4. Сделать **hard reload** (Ctrl+Shift+R)
5. Сразу после загрузки: `useServiceWorkerController` → `false` (SW ещё не взял контроль)
6. Через секунду: → `true` (SW активировался)
7. Объяснить: при `false` — офлайн-погода недоступна, компонент показывает fallback

---

## ⚙️ Команды для подготовки

```bash
# Проверить что SW зарегистрирован
# В консоли браузера:
navigator.serviceWorker.getRegistrations().then(r => console.log(r))

# Проверить подписку на push
navigator.serviceWorker.ready.then(r =>
  r.pushManager.getSubscription().then(s => console.log(s))
)

# Проверить размер IDB
# В консоли браузера:
navigator.storage.estimate().then(e =>
  console.log('Used:', (e.usage / 1024 / 1024).toFixed(2), 'MB')
)
```
