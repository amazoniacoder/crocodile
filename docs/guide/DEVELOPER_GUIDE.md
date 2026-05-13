# NewsAggregator — Developer Guide

> Практическое руководство для разработчиков
> Проверено по коду: Май 2025 · версия 2.1.0

📚 **Навигация:** [Документация](../DOCUMENTATION_INDEX.md) • [Архитектура](../ARCHITECTURE.md) • [Быстрый старт](../ONBOARDING.md)

---

## Навигация по коду

| Задача | Файл |
|--------|------|
| Оркестрация сбора (cron, кластер, событие `articles.collected`) | `server/application/news/CollectNewsUseCase.ts` |
| Сбор одного RSS, fast/slow-источники | `server/application/news/RssCollectionService.ts` |
| Сохранение статей + NER после вставки | `server/application/news/ArticleManagementService.ts` |
| Расписание cron из БД | `server/application/news/ScheduleManagementService.ts` |
| Парсинг RSS | `server/infrastructure/rss/RssParser.ts` |
| Кластеризация по событию | `server/application/news/ClusterNewsUseCase.ts` |
| Правила похожести заголовков | `server/domain/news/NewsCluster.ts` |
| «Похожие новости» на карточке | `server/application/news/EntityClusterService.ts` |
| Инвалидация кэша, WebSocket, Web Push после сбора | `server/application/news/subscribers.ts` |
| HTTP-клиент NER + батчи | `server/infrastructure/ner/NerService.ts` |
| Деградация при недоступности NER | `server/infrastructure/ner/GracefulNerService.ts` |
| Метрики очереди NER (админка) | `server/infrastructure/ner/NerBatchProcessor.ts` |
| Публичное API YouTube | `server/api/youtube/index.ts` |
| Публичное API Telegram | `server/api/telegram/index.ts` |
| Admin API Telegram (Zone L) | `server/api/admin/telegram/index.ts` |
| Admin API YouTube (Zone M) | `server/api/admin/youtube/index.ts` [planned] |
| Публичное API новостей | `server/api/news/index.ts` |
| Сборка маршрутов | `server/api/index.ts` |
| Кэш ленты (Redis + memory, теги) | `server/infrastructure/monitoring/QueryCacheService.ts` |
| Аудит | `server/infrastructure/audit/AuditLogger.ts` |
| Токены администраторов | `server/infrastructure/auth/TokenManager.ts` |
| API-ключи публичного API | `server/infrastructure/auth/ApiKeyService.ts` |
| Middleware API-ключей (rate limit) | `server/middleware/apiKeyAuth.ts` |
| Web Push рассылка | `server/infrastructure/push/WebPushService.ts` |
| DDoS / лимиты | `server/middleware/ddosProtection.ts` |
| Алерты (единая система) | `server/infrastructure/monitoring/AlertManager.ts` |
| Здоровье компонентов | `server/infrastructure/monitoring/HealthMonitoringService.ts` |
| Публичное API погоды, кэш week/locations | `server/api/weather/index.ts` |
| Open-Meteo (прогноз + почасовка диапазоном дат) | `server/infrastructure/weather/OpenMeteoClient.ts` |
| Страница погоды, офлайн-кэш | `client/src/pages/WeatherPage.tsx`, `client/src/services/weatherCache.ts`, `client/src/services/weatherDb.ts` |
| Обзор модуля погоды | `docs/guide/WEATHER_SYSTEM_GUIDE.md` |
| Типы и схема | `server/domain/news/`, `shared/types/schema.ts`, `shared/types/weather.ts` |
| Web Push статистика (stats) | `server/api/push/index.ts` |
| Тесты сервера | `server/__tests__/` |
| **PWA / офлайн** | |
| Dexie-схема (IDB) | `client/src/services/db.ts` |
| Запись/чтение ленты и деталей офлайн | `client/src/services/offlineStore.ts` |
| Очередь офлайн-реакций | `client/src/services/pendingActionsService.ts` |
| Web Push подписка/отписка | `client/src/services/push-service.ts` |
| Хук состояния push-подписки | `client/src/hooks/usePushNotifications.ts` |
| Состояние сети + ping `/api/health` | `client/src/hooks/useOnlineStatus.ts` |
| Индикатор онлайн/офлайн над лентой | `client/src/components/news/FeedConnectionIndicator.tsx` |
| Якорь скролла виртуального списка | `client/src/components/news/NewsFeed.tsx` |
| Тост «Доступна новая версия» | `client/src/components/common/PwaUpdateToast.tsx` |
| Service Worker (push + precache) | `client/src/sw.ts` |
| Манифест + VitePWA (injectManifest) | `vite.config.js` |

---

## Аутентификация Admin API

Все admin-роуты используют единый middleware `authenticateAdmin` (`server/middleware/security.ts`):
- Сначала проверяется токен из **TokenManager** (таблица `admin_tokens`)
- При невалидности — fallback на legacy `ADMIN_TOKEN` из `.env`

Заголовок: `Authorization: Bearer <token>`

> **Важно:** Все admin-роуты используют `authenticateAdmin` из `server/middleware/security.ts`. Не создавать новых middleware для аутентификации.

---

## Настройка окружения

### Переменные `.env`

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgres://user:password@localhost:5432/news_aggregator
REDIS_URL=redis://localhost:6379
ADMIN_TOKEN=<секрет>

NER_SERVICE_URL=http://ner-service:8001
NER_BATCH_SIZE=10
NER_TIMEOUT_MS=5000

JAEGER_ENDPOINT=http://localhost:14268/api/traces
SERVICE_NAME=news-aggregator
IP_WHITELIST=127.0.0.1,::1

# Rate Limiting
MAX_RATE_LIMITERS=1000

# Web Push (VAPID) — генерация: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=<публичный ключ>
VAPID_PRIVATE_KEY=<приватный ключ>
VAPID_SUBJECT=mailto:admin@example.com
PUSH_THRESHOLD=5

# Мониторинг безопасности
DOMAIN=example.com                    # Домен для SSL-мониторинга
ALERT_WEBHOOK_URL=https://hooks.slack.com/...  # Webhook для критических алертов
```

---

## Частые задачи

### Добавить источник

```bash
curl -X POST http://localhost:5000/api/admin/news/sources \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "РИА Новости",
    "url": "https://ria.ru",
    "rssUrl": "https://ria.ru/export/rss2/archive/index.xml",
    "region": "russia",
    "category": "other"
  }'
```

| `YouTube-канал` | `youtube` | `https://www.youtube.com/@channel` | `https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxx` |
| `Telegram-канал` | `telegram` | `https://t.me/channel` | `{RSSHUB_URL}/telegram/channel/username` |

`region`: `russia` | `world`
`category`: `economy` | `tech` | `politics` | `society` | `other`

### Запустить сбор вручную

```bash
curl -X POST http://localhost:5000/api/admin/jobs/rss-collect \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"group": "all"}'
```

### Изменить интервал сбора

```bash
curl -X PATCH http://localhost:5000/api/admin/config \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "fast_interval_cron", "value": "*/2 * * * *"}'
```

Изменения подхватываются без перезапуска.

### Управление API-ключами

```bash
# Создать ключ
curl -X POST http://localhost:5000/api/admin/api-keys \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Telegram-бот", "requestsPerMinute": 120}'

# Список ключей
curl http://localhost:5000/api/admin/api-keys \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Отозвать ключ
curl -X DELETE http://localhost:5000/api/admin/api-keys/<id> \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Ключ передаётся клиентом через `X-Api-Key: na_...` или `?api_key=na_...`.
Без ключа: 120 req/мин. С ключом: лимит из БД (default 60 req/мин).

### Web Push — генерация VAPID-ключей

```bash
npx web-push generate-vapid-keys
# Вставить результат в .env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
```

Push отправляется автоматически при `insertedCount >= PUSH_THRESHOLD` за один цикл сбора.

### Аудит

```bash
curl "http://localhost:5000/api/admin/audit/logs?limit=50" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Очистка записей старше N дней
curl -X POST http://localhost:5000/api/admin/audit/cleanup \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"olderThanDays": 180}'
```

### NER

```bash
curl http://localhost:5000/api/admin/ner/metrics \
  -H "Authorization: Bearer $ADMIN_TOKEN"
curl http://localhost:5000/api/admin/ner/health \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Метрики rate limiting

```bash
curl http://localhost:5000/api/admin/monitoring/rate-limiters \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Мониторинг безопасности

```bash
# Проверить SSL сертификат
curl "http://localhost:5000/api/admin/monitoring/ssl-status" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Статистика алертов
curl "http://localhost:5000/api/admin/alerts/stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# История алертов
curl "http://localhost:5000/api/admin/alerts/history?limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Проверка статуса Fail2Ban
curl "http://localhost:5000/api/admin/monitoring/fail2ban-status" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Комплексная проверка безопасности
./scripts/security-monitor.sh
```

Ответ:
```json
{
  "success": true,
  "stats": {
    "activeLimiters": 42,
    "maxLimiters": 1000,
    "utilizationPercent": 4,
    "lruEvictions": 0
  }
}
```

### Отладка PWA / Service Worker

Подробное описание PWA см. в [PWA_IMPLEMENTATION.md](./PWA_IMPLEMENTATION.md).

> ⚠️ **Примечание:** `POST /api/admin/news/sources` хардкодит `sourceType: 'rss'`. YouTube и Telegram каналы добавляются через специализированные Admin API (`/api/admin/youtube/`, `/api/admin/telegram/`). Подробнее: [YOUTUBE_FIX_PLAN.md](../YOUTUBE_FIX_PLAN.md)

- DevTools → Application → Service Workers — статус SW, кнопка «Update»
- DevTools → Application → Storage — IndexedDB (`news-aggregator-offline`), Cache Storage (`news-images`)
- Принудительный сброс: DevTools → Application → Service Workers → «Unregister»
- Офлайн-режим: DevTools → Network → «Offline» — лента из IDB, индикатор жёлтый
- Push: DevTools → Application → Notifications — статус разрешения

---

## API (кратко)

### Публичные эндпоинты

Все публичные эндпоинты защищены `apiKeyAuth`:
- без ключа: 120 req/мин по IP
- с ключом (`X-Api-Key` или `?api_key=`): лимит из таблицы `api_keys`

| Метод | Путь | Кэш |
|-------|------|-----|
| GET | `/api/youtube/status` | — |
| GET | `/api/youtube/channels` | — |
| GET | `/api/youtube/channel/:channelId` | — |
| GET | `/api/telegram/status` | — |
| GET | `/api/telegram/channels` | — |
| GET | `/api/telegram/channel/:username` | — |
| GET | `/api/news` | 300 с + `max-age=60` |
| GET | `/api/news/search?q=` | 120 с |
| GET | `/api/news/sources` | 3600 с |
| GET | `/api/news/cities` | 3600 с |
| GET | `/api/news/clusters/:id` | 300 с |
| GET | `/api/news/popular` | 300 с |
| GET | `/api/news/top-liked` | 300 с |
| GET | `/api/news/reaction-counts` | no-store |
| GET | `/api/rss` | RSS-экспорт отфильтрованной ленты |
| POST | `/api/news/:id/react` | — |
| POST | `/api/news/:id/emotion` | — |
| POST | `/api/events` | — |
| GET | `/api/health` | — |
| GET | `/api/push/vapid-public-key` | — |
| GET | `/api/push/stats` | — (authenticateAdmin) |
| POST | `/api/push/subscribe` | — |
| DELETE | `/api/push/subscribe` | — |
| GET | `/api/weather/locations` | 3600 с |
| GET | `/api/weather/week?locationId=` | 3600 с |
| GET | `/api/weather?locationId=` | 3600 с |
| GET | `/api/weather/hourly?locationId=&date=` | 3600 с |

### GET `/api/news` — параметры

`region`, `category` (один или несколько через `&category=`), `city`, `date`, `dateFrom`, `dateTo`, `tzOffsetMinutes`, `page` (default **1**), `limit` (default **20**, max **100**), `sourceIds`, `enabledRussia`, `enabledWorld`, `enabledCities`.

### Admin: все роуты (`authenticateAdmin`)

| Префикс | Назначение |
|---------|-----------|
| `/api/admin/news/*` | Источники, ручной сбор |
| `/api/admin/config` | Настройки планировщика |
| `/api/admin/monitor/*` | Мониторинг сбора |
| `/api/admin/monitoring/*` | Здоровье системы, кэш, алерты |
| `/api/admin/alerts/*` | Панель алертов |
| `/api/admin/analytics/*` | Аналитика посещений, география, устройства |
| `/api/admin/audit/*` | Аудит действий |
| `/api/admin/security/*` | DDoS защита |
| `/api/admin/tokens/*` | Управление токенами |
| `/api/admin/sla/*` | SLA метрики |
| `/api/admin/jobs/*` | Ручной запуск джоб |
| `/api/admin/ner/*` | NER метрики и управление |
| `/api/admin/cluster/*` | Кластер и failover |
| `/api/admin/rss/*` | Rate limit статистика |
| `/api/admin/api-keys` | Управление API-ключами |
| `/api/admin/weather/*` | Управление городами погоды, ручной сбор |
| `/api/admin/telegram/*` | Управление Telegram-каналами (Zone L) |
| `/api/admin/youtube/*` | Управление YouTube-каналами (Zone M) [planned] |
| `/api/admin/user-tokens` | Управление токенами личных кабинетов (Zone N) |

---

## Кабинет мониторинга

Подробное описание всех зон (A-M) и интерфейса см. в [MONITOR_GUIDE.md](./MONITOR_GUIDE.md).

### Мониторинг API

Все запросы требуют `Authorization: Bearer <ADMIN_TOKEN>`.

```bash
# Статистика сбора по источникам за 24ч
curl "http://localhost:5000/api/admin/monitor/stats?hours=24" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Статьи по источникам с разбивкой по часам
curl "http://localhost:5000/api/admin/monitor/chart?hours=24" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Последние 50 циклов сбора для графика
curl "http://localhost:5000/api/admin/monitor/timing?limit=50" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Системные метрики (RSS, CPU, Uptime, статус коллектора)
curl http://localhost:5000/api/admin/monitor/system \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Статьи за последний час
curl "http://localhost:5000/api/admin/monitor/recent-articles?hours=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Доступность RSSHub
curl http://localhost:5000/api/admin/monitor/rsshub \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Тесты

Подробное руководство см. в [TESTING.md](../TESTING.md).

```bash
npm test              # все тесты (server + client)
npm run test:server   # unit + integration + e2e сервера
npm run test:client   # тесты клиента (happy-dom)
```

---

## Развёртывание

```bash
npm run build
npm run start
```

### Nginx — WebSocket

```nginx
location /ws {
  proxy_pass http://localhost:5000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

### PWA в production

- SW компилируется из `client/src/sw.ts` через `injectManifest` стратегию VitePWA.
- Обработчики: `push` (Web Push уведомления), `notificationclick`, `message` (skipWaiting).
- При обновлении сборки — тост «Доступна новая версия» → кнопка «Обновить».
- Стратегия `registerType: "prompt"` — SW ждёт подтверждения.

---

*Обновляйте документ при изменении маршрутов или процедур.*

