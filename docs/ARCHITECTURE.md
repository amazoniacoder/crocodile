# NewsAggregator — Архитектура

> **Версия:** 2.2.0  
> **Создан:** Май 2025  
> **Последнее обновление:** Май 2025  
> **Статус:** Production

---

## Обзор

Независимый новостной агрегатор без алгоритмов подтасовки. Собирает новости из проверенных RSS-источников, группирует похожие материалы из разных СМИ и отдаёт их в реальном времени.

**Ключевые принципы:**
- Белый список источников — только проверенные СМИ
- Регион и категория наследуются от источника, без угадывания
- Пользователь всегда видит, откуда пришла новость
- Без скрытой подборки и манипуляций

---

## Быстрая навигация

### Диаграммы
- [Потоки данных](./diagrams/DATA_FLOW.md) — 7 sequence/flowchart диаграмм основных процессов
- [C4 Architecture](./diagrams/C4_ARCHITECTURE.md) — Context, Container, Component, Deployment
- [Схема БД](./diagrams/DATABASE_SCHEMA.md) — ER-диаграмма, индексы, триггеры, жизненный цикл
- [Зависимости модулей](./diagrams/MODULE_DEPENDENCIES.md) — DDD layers, правила импорта

### Специализированные гайды
- [Developer Guide](./guide/DEVELOPER_GUIDE.md) — частые задачи, curl-команды, навигация по коду
- [YouTube Guide](./guide/YOUTUBE_GUIDE.md) — добавление каналов, архитектура, API
- [Telegram Guide](./guide/TELEGRAM_GUIDE.md) — интеграция Telegram-каналов
- [NER Service](./guide/NER_SERVICE_GUIDE.md) — Entity-Driven Cluster, запуск, настройка
- [Clustering](./guide/CLUSTERING_GUIDE.md) — токенная кластеризация, морфологическая нормализация
- [Weather System](./guide/WEATHER_SYSTEM_GUIDE.md) — модуль погоды, API, компоненты
- [Personal Feed](./guide/PERSONAL_FEED_GUIDE.md) — личные кабинеты, токены, подписки
- [PWA Implementation](./guide/PWA_IMPLEMENTATION.md) — офлайн-режим, Service Worker, IndexedDB
- [Monitor Guide](./guide/MONITOR_GUIDE.md) — кабинет мониторинга, метрики
- [Donate Guide](./guide/DONATE_GUIDE.md) — система донатов
- [Analytics Guide](./guide/ANALYTICS_GUIDE.md) — анонимная аналитика

### Операционные руководства
- [Testing](./TESTING.md) — тесты, покрытие, запуск
- [Troubleshooting](./TROUBLESHOOTING.md) — типичные проблемы и решения
- [Performance](./guide/PERFORMANCE.md) — оптимизация, кэширование, масштабирование
- [API Keys Guide](./guide/API_KEYS_GUIDE.md) — управление API-ключами
- [Authentication](./AUTHENTICATION.md) — TokenManager, authenticateAdmin

### Архитектурные решения
- [ADR Index](./adr/README.md) — список Architecture Decision Records

---

## Технологический стек

### Frontend
- **React 18.3.1** + **TypeScript 5.6.3**
- **Vite 6.3.5** — сборка и HMR
- **Wouter** — роутинг
- **Zustand** — состояние
- **@tanstack/react-virtual** — виртуализация ленты
- **Dexie.js** — IndexedDB офлайн-архив
- **Workbox** — Service Worker

### Backend
- **Node.js 20** + **Express.js 4.21.2**
- **PostgreSQL 17** + **Drizzle ORM**
- **Redis 7** — кэширование
- **WebSocket (express-ws)** — real-time уведомления
- **web-push** — Web Push уведомления (VAPID)
- **rss-parser** — парсинг RSS-лент
- **node-cron** — планировщик задач

### External Services
- **FastAPI** — NER service (Natasha + pymorphy2)
- **Open-Meteo** — прогноз погоды
- **NOAA** — геомагнитная активность

---

## Архитектурные слои (DDD)

```
┌─────────────────────────────────────────┐
│           API Layer                     │  HTTP, WebSocket, валидация
│  api/news, api/admin, api/weather       │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│       Application Layer                 │  Use Cases, сценарии
│  CollectNewsUseCase, ClusterNewsUseCase │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│      Infrastructure Layer               │  БД, RSS, NER, кэш, push
│  Repositories, NerService, Redis        │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│         Domain Layer                    │  Бизнес-логика, правила
│  NewsCluster, NewsArticle               │  (не зависит от фреймворков)
└─────────────────────────────────────────┘
```

**Правило изоляции:** Domain Layer не импортирует верхние слои.

> Подробнее: [MODULE_DEPENDENCIES.md](./diagrams/MODULE_DEPENDENCIES.md)

---

## Основные потоки данных

### 1. Сбор новостей

```
node-cron → CollectNewsUseCase → RssCollectionService → RssParser → RSS-источники
  ↓
ArticleManagementService → PostgreSQL (INSERT, дедупликация по URL)
  ↓
NerService → NER Service (POST /extract, батчи по 10)
  ↓
EventBus.emit('articles.collected')
  ↓
┌─────────────────────────────────────────────────────────┐
│ Подписчики:                                             │
│ • ClusterNewsUseCase → кластеризация                    │
│ • QueryCacheService → инвалидация кэша                  │
│ • WebSocketManager → уведомление клиентов               │
│ • WebPushService → push-рассылка (если >= 5 статей)     │
└─────────────────────────────────────────────────────────┘
```

> Подробнее: [DATA_FLOW.md](./diagrams/DATA_FLOW.md)

### 2. Чтение ленты

```
Browser → GET /api/news?region=russia&category=tech
  ↓
apiKeyAuth → rate limit (120 req/мин без ключа, лимит из БД с ключом)
  ↓
QueryCacheService → Redis (TTL 300s)
  ↓ (при промахе)
NewsArticleRepository → PostgreSQL
  ↓
Ответ → Browser + сохранение в IndexedDB (офлайн-режим)
```

> Подробнее: [DATA_FLOW.md](./diagrams/DATA_FLOW.md)

### 3. Похожие новости (Entity-Driven Cluster)

```
GET /api/news/:id → EntityClusterService.findSimilarArticles
  ↓
Шаг 1: Entity-поиск (48ч окно, минимум 2 совпадения терминов)
  ↓ (если пусто)
Шаг 2: Cluster fallback (токенная кластеризация)
  ↓ (если пусто)
Шаг 3: Category fallback (3 статьи из той же категории)
```

> Подробнее: [DATA_FLOW.md](./diagrams/DATA_FLOW.md), [NER_SERVICE_GUIDE.md](./guide/NER_SERVICE_GUIDE.md)

---

## База данных

**18 таблиц:****

| Таблица | Назначение |
|---------|-----------|
| `news_sources` | Белый список RSS-источников |
| `news_articles` | Собранные статьи (UNIQUE по URL, GIN-индекс `search_vector`, `entities`) |
| `news_clusters` | Группы похожих новостей |
| `collection_stats` | Статистика каждого цикла сбора |
| `source_config` | Настройки планировщика и доната |
| `page_events` | Анонимная аналитика посещений и кликов |
| `article_reactions` | Лайки и дизлайки |
| `article_emotions` | Эмодзи-реакции |
| `hot_entities` | Горячие NER-сущности за 24ч |
| `admin_audit_log` | Аудит административных действий |
| `admin_tokens` | Токены администраторов |
| `push_subscriptions` | Web Push подписки пользователей |
| `api_keys` | API-ключи для публичного API |
| `weather_locations` | Города для модуля погоды |
| `weather_forecasts` | Дневные прогнозы (7 дней × N городов) |
| `weather_hourly_forecasts` | Почасовые прогнозы (168 часов × N городов) |
| `user_tokens` | Токены доступа к личным кабинетам |
| `user_channel_subscriptions` | Подписки пользователей на каналы |

> Подробнее: [DATABASE_SCHEMA.md](./diagrams/DATABASE_SCHEMA.md), [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md)

---

## Ключевые компоненты

### RSS Сбор

**Файлы:**
- `server/application/news/CollectNewsUseCase.ts` — оркестрация
- `server/application/news/RssCollectionService.ts` — сбор из источников
- `server/infrastructure/rss/RssParser.ts` — парсинг RSS

**Особенности:**
- Два расписания: fast (каждую минуту) и slow (каждые 5 минут)
- Rate limiting по домену (500ms между источниками)
- Strict → lenient fallback при ошибках парсинга
- Дедупликация по URL: `INSERT ... ON CONFLICT DO NOTHING`

### Кластеризация

**Файлы:**
- `server/application/news/ClusterNewsUseCase.ts` — логика кластеризации
- `server/domain/news/NewsCluster.ts` — правила схожести

**Алгоритм:**
1. Статьи за окно без `cluster_id`
2. Бакеты `region:category`
3. Морфологическая нормализация заголовков через NER (`/normalize`)
4. `areSimilarNormalized` — порог 0.6 (Jaccard similarity)
5. Группы ≥ 2 статей → запись в `news_clusters`

> Подробнее: [CLUSTERING_GUIDE.md](./guide/CLUSTERING_GUIDE.md)

### Entity-Driven Cluster

**Файлы:**
- `server/application/news/EntityClusterService.ts` — поиск похожих
- `server/infrastructure/ner/NerService.ts` — HTTP-клиент NER

**Алгоритм:**
1. Извлечь все термины из `entities.PER + ORG + LOC`
2. `SELECT WHERE published_at >= NOW() - 48h AND (term1 ILIKE OR term2 ILIKE ...)`
3. Фильтр: совпадение ≥ 2 терминов
4. Fallback на токенный кластер, затем на категорию

> Подробнее: [NER_SERVICE_GUIDE.md](./guide/NER_SERVICE_GUIDE.md)

### Кэширование

**Файлы:**
- `server/infrastructure/monitoring/QueryCacheService.ts` — двухуровневый кэш

**Стратегия:**
- Redis (primary) → In-Memory (fallback)
- TTL 300s для ленты, stale-while-revalidate 60s
- Тегированная инвалидация по EventBus (`['news', 'clusters']`)
- `advancedCache` для погоды (явная инвалидация по шаблону)

> Подробнее: [PERFORMANCE.md](./guide/PERFORMANCE.md)

### Web Push

**Файлы:**
- `server/infrastructure/push/WebPushService.ts` — VAPID рассылка
- `client/src/sw.ts` — Service Worker (push handler)

**Поток:**
1. Пользователь разрешает уведомления
2. `pushManager.subscribe(VAPID_PUBLIC_KEY)`
3. `POST /api/push/subscribe` → `push_subscriptions`
4. При `insertedCount >= PUSH_THRESHOLD` → `WebPushService.broadcast`
5. Батчи по 100, автоудаление 410/404

> Подробнее: [PWA_IMPLEMENTATION.md](./guide/PWA_IMPLEMENTATION.md)

### Офлайн-режим

**Файлы:**
- `client/src/services/offlineStore.ts` — IndexedDB для ленты
- `client/src/services/pendingActionsService.ts` — очередь офлайн-действий
- `client/src/sw.ts` — Service Worker (fetch interceptor)

**Особенности:**
- TTL 14 дней, лимит 3000 статей
- GC при превышении лимита
- Офлайн-реакции → очередь → синхронизация при возврате онлайн

> Подробнее: [PWA_IMPLEMENTATION.md](./guide/PWA_IMPLEMENTATION.md)

### YouTube

**Файлы:**
- `server/api/youtube/index.ts` — API роутер
- `client/src/pages/youtube/YouTubePage.tsx` — страница `/youtube`
- `client/src/components/news/YouTubeEmbed.tsx` — iframe-плеер

**Особенности:**
- Официальные RSS-фиды YouTube (`/feeds/videos.xml?channel_id=`)
- Парсинг `yt:videoId` и `media:thumbnail` в `RssParser`
- Плеер встраивается inline в карточку (aspect-ratio 16/9)
- Флаг `is_featured` для витринного канала (бесплатный доступ)

> Подробнее: [YOUTUBE_GUIDE.md](./guide/YOUTUBE_GUIDE.md)

> ⚠️ **[planned]** Admin Zone M (управление YouTube-каналами из кабинета мониторинга) — см. [YOUTUBE_FIX_PLAN.md](./YOUTUBE_FIX_PLAN.md)

### Telegram

**Файлы:**
- `server/api/telegram/index.ts` — API роутер
- `client/src/pages/telegram/TelegramPage.tsx` — страница `/social`
- `client/src/components/news/TelegramEmbed.tsx` — виджет поста

> Подробнее: [TELEGRAM_GUIDE.md](./guide/TELEGRAM_GUIDE.md)

### Погода

**Файлы:**
- `server/application/weather/WeatherCollectionService.ts` — сбор каждые 3 часа
- `server/infrastructure/weather/OpenMeteoClient.ts` — API-клиент
- `client/src/pages/WeatherPage.tsx` — UI (130 строк после рефакторинга)

**Особенности:**
- 51 город России
- 7 дней дневных прогнозов + 2 дня почасовки
- Геомагнитная активность (NOAA Kp-индекс)
- Фазы луны, UV-индекс, порывы ветра
- Офлайн-кэш в IndexedDB (TTL 1 час)

> Подробнее: [WEATHER_SYSTEM_GUIDE.md](./guide/WEATHER_SYSTEM_GUIDE.md)

---

## Безопасность

### Аутентификация Admin API

**Единый middleware:** `authenticateAdmin` (`server/middleware/security.ts`)
1. Проверка токена через `TokenManager` (таблица `admin_tokens`)
2. Fallback на legacy `ADMIN_TOKEN` из `.env`

> Подробнее: [AUTHENTICATION.md](./AUTHENTICATION.md)

### API-ключи публичного API

**Управление:** `ApiKeyService` (`server/infrastructure/auth/ApiKeyService.ts`)
- Ключ: `na_` + 24 random bytes
- Хранится только SHA-256 хэш
- Валидация с Redis-кэшем 5 мин
- Rate limiting: 120 req/мин без ключа, лимит из БД с ключом

> Подробнее: [API_KEYS_GUIDE.md](./guide/API_KEYS_GUIDE.md)

### Аудит

**Файлы:**
- `server/infrastructure/audit/AuditLogger.ts`
- Таблица `admin_audit_log`

**Логируется:**
- Все административные действия (CREATE, UPDATE, DELETE)
- IP, User-Agent, токен (хэш)
- Состояние до/после изменения (JSONB)
- Успех/ошибка

Хранится 6 месяцев.

### DDoS Protection

**Файлы:**
- `server/middleware/ddosProtection.ts`
- `server/middleware/apiKeyAuth.ts`

**Механизмы:**
- Rate limiting по IP (express-rate-limit)
- LRU-кэш лимитеров (MAX_RATE_LIMITERS, default 1000)
- Whitelist IP для внутренних запросов

---

## Мониторинг и алерты

### Кабинет мониторинга

**Зоны:**
- A: Parser Health — статистика сбора
- B: Infrastructure — системные метрики + Web Push stats
- C: Control Room — источники, конфиг
- D: Analytics — посещения и клики
- E: Hot Entities — горячие NER-сущности
- F: Cluster Health
- G: Cluster Tests
- H: SLA — производительность
- I: Token Management
- J: API Keys
- K: Weather — управление городами
- L: Telegram — управление Telegram-каналами
- M: YouTube — управление YouTube-каналами [planned] — см. [YOUTUBE_FIX_PLAN.md](./YOUTUBE_FIX_PLAN.md)
- N: User Tokens — управление токенами личных кабинетов

> Подробнее: [MONITOR_GUIDE.md](./guide/MONITOR_GUIDE.md)

### Система алертов

**Файлы:**
- `server/infrastructure/monitoring/AlertManager.ts`

**17 правил алертов:**
- RSS сбор (ошибки, задержки)
- БД, Redis (недоступность)
- Кластер (failover)
- Rate limiters (переполнение)
- Память (утечки)
- **SSL сертификат** — 30 дней (warning), 7 дней (critical)
- **Disk usage** — 80% (warning), 90% (critical)
- **Fail2Ban** — высокая активность банов, статус сервиса

**Интеграция:**
- WebSocket-уведомления
- Webhook для критических алертов (Slack/Discord)
- Redis-персистентность
- Cooldown по каждому правилу

### SSL и Disk мониторинг

**Интеграция с AlertManager:**
- SSL сертификат проверяется каждые 30 секунд
- Алерты за 30 дней (warning) и 7 дней (critical) до истечения
- Disk usage мониторинг: 80% (warning), 90% (critical)
- Все алерты через единую систему: WebSocket + Webhook + Log

**Новые правила алертов:**
- `ssl-certificate-expiring` — SSL истекает через 30 дней
- `ssl-certificate-critical` — SSL истекает через 7 дней  
- `disk-space-warning` — диск заполнен на 80%
- `disk-space-critical` — диск заполнен на 90%
- `fail2ban-high-bans` — более 50 банов за 24ч
- `fail2ban-service-down` — сервис Fail2Ban не запущен

---

## Горизонтальное масштабирование

**Файлы:**
- `server/infrastructure/cluster/LoadBalancer.ts`
- `server/infrastructure/cluster/DistributedScheduler.ts`
- `server/infrastructure/cluster/FailoverController.ts`

**Механизмы:**
- Распределение сбора через Redis-блокировки
- Heartbeat каждые 30 секунд
- Автоматический failover при падении ноды
- Sticky sessions для WebSocket

---

## Расписание обслуживания

| Время | Задача |
|-------|--------|
| Ежедневно 03:00 | Архивирование статей старше 14 дней |
| Воскресенье 04:00 | Удаление архивных статей старше 14 дней |
| Воскресенье 04:30 | Удаление статистики сбора старше 7 дней |
| Воскресенье 05:00 | Удаление событий аналитики старше 90 дней |
| Воскресенье 06:00 | Очистка погодных прогнозов (>14 дней дневные, >10 дней почасовка) |
| Каждый час | HotEntitiesJob — топ-100 сущностей за 24ч |
| Каждые 3 часа | WeatherCollectionService — 51 город |
| Каждые 6 часов | Очистка истёкших токенов (TokenManager) |

---

## Deployment

### Docker Compose

```yaml
services:
  app:
    build: .
    ports: ["5000:5000"]
    environment:
      - DATABASE_URL
      - REDIS_URL
      - NER_SERVICE_URL=http://ner-service:8001
  
  postgres:
    image: postgres:17
    volumes: ["./data/postgres:/var/lib/postgresql/data"]
  
  redis:
    image: redis:7
    volumes: ["./data/redis:/data"]
  
  ner-service:
    build: ./ner-service
    ports: ["8001:8001"]
  
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes: ["./nginx.conf:/etc/nginx/nginx.conf"]
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

---

## Метрики успеха

- **Uptime:** 99.9% (SLA)
- **Сбор новостей:** каждые 1-5 минут
- **Latency API:** p95 < 200ms
- **Кэш hit rate:** > 80%
- **Офлайн-режим:** работает без сети
- **Web Push:** доставка < 5 секунд
- **Погода:** обновление каждые 3 часа

---

## История изменений

- [IMPROVEMENT_PLAN.md](./IMPROVEMENT_PLAN.md) — план v1 (реализован)
- [IMPROVEMENT_PLAN_V2.md](./IMPROVEMENT_PLAN_V2.md) — план v2 (реализован)
- [IMPROVEMENT_PLAN_V3.md](./IMPROVEMENT_PLAN_V3.md) — план v3 (реализован)
- [TECHNICAL_DEBT_PLAN.md](./TECHNICAL_DEBT_PLAN.md) — устранение долга
- [TECHNICAL_DEBT_PROGRESS.md](./TECHNICAL_DEBT_PROGRESS.md) — статус выполнения
- [DOCUMENTATION_IMPROVEMENT_PLAN.md](./DOCUMENTATION_IMPROVEMENT_PLAN.md) — улучшение документации

---

*Сделано с ❤️ — без алгоритмов, без манипуляций*
