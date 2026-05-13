# Эпизод 6: Готовность к производству

> **Статус:** ✅ Готов к записи
> **Документация:** 100% завершена
> **Код проверен:** Соответствует реальной реализации

---

## 📋 Что создано

1. **[script.md](./script.md)** — Детальный сценарий (22-25 минут)
2. **[slides-outline.md](./slides-outline.md)** — 22 слайда, 4 блока + заключение
3. **[diagrams-list.md](./diagrams-list.md)** — 7 диаграмм архитектуры PWA
4. **[demo-scenarios.md](./demo-scenarios.md)** — 6 сценариев демонстрации в браузере
5. **[code-examples.md](./code-examples.md)** — Примеры из реального кода (8 файлов)
6. **[interactive-elements.md](./interactive-elements.md)** — 3 вызова, 3 опроса, челлендж
7. **[recording-preparation.md](./recording-preparation.md)** — Чек-лист и порядок файлов

---

## 🎯 Ключевые сообщения

- **injectManifest** — ручной SW, полный контроль над стратегиями кэширования
- **Четыре стратегии** — Precache / NetworkFirst (pages) / CacheFirst (images) / NetworkOnly (API)
- **Погода — особый случай** — SW читает IDB напрямую, заголовок `X-Cache: indexeddb`
- **Две IDB базы** — `news-aggregator-offline` (NewsDb v3, 6 таблиц) + `weather-cache` (WeatherDatabase v3, 3 таблицы)
- **Два TTL для погоды** — 1ч онлайн / 24ч офлайн (любые данные лучше пустого экрана)
- **GC** — раз в сутки, при старте + visibilitychange → visible
- **VAPID без FCM** — стандарт W3C, нет зависимости от Google
- **Pending Actions** — MAX_RETRIES=3, fallback через `window.online` (iOS совместимость)
- **Prompt-стратегия** — пользователь контролирует момент обновления SW
- **useServiceWorkerController** — undefined/false/true, нужен для офлайн-погоды

---

## ⚠️ Исправления относительно script.md

| Расхождение | Было в script.md | Реальный код |
|-------------|-----------------|--------------|
| TTL погоды | только 1 час | 1ч онлайн / 24ч офлайн / 7 дней max |
| IDB погоды | не упомянута | отдельная база `weather-cache` (weatherDb.ts) |
| GC триггеры | только при старте | при старте + visibilitychange |
| useServiceWorkerController | не упомянут | хук для проверки активного SW |
| WeatherDatabase версии | не упомянуто | v3 с `.upgrade(tx => tx.table('hourly').clear())` |

---

## 📁 Файлы проекта для демонстрации

```
client/src/
├── main.tsx
├── sw.ts
├── services/
│   ├── db.ts
│   ├── weatherDb.ts
│   ├── weatherCache.ts
│   ├── offlineStore.ts
│   ├── push-service.ts
│   └── pendingActionsService.ts
├── hooks/
│   ├── usePushNotifications.ts
│   ├── useServiceWorkerController.ts
│   └── useOnlineStatus.ts
└── components/common/
    └── PwaUpdateToast.tsx
```

---

**Эпизод 6 готов к производству! 🚀**
