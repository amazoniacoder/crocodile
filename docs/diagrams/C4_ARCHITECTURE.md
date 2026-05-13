# C4 Architecture Model

> Версия: 1.0  
> Создан: Май 2025

---

## Level 1: System Context

```mermaid
C4Context
    title System Context — NewsAggregator (Crocodile)

    Person(user, "Пользователь", "Читает новости, фильтрует, реагирует")
    Person(admin, "Администратор", "Управляет источниками, мониторинг")
    
    System(aggregator, "NewsAggregator", "Независимый новостной агрегатор без алгоритмов подтасовки")
    
    System_Ext(rss, "RSS-источники", "Lenta, RBC, Habr, The Guardian, Al Jazeera, ТАСС, Reuters")
    System_Ext(openmeteo, "Open-Meteo API", "Прогноз погоды для 51 города")
    System_Ext(noaa, "NOAA Kp API", "Геомагнитная активность")
    System_Ext(ner, "NER Service", "FastAPI + Natasha + pymorphy2")
    System_Ext(browser, "Браузер", "Chrome, Firefox, Safari с Web Push")
    
    Rel(user, aggregator, "Читает ленту, фильтрует, реагирует", "HTTPS")
    Rel(admin, aggregator, "Управляет источниками, мониторинг", "HTTPS + Bearer Token")
    Rel(aggregator, rss, "Собирает статьи", "RSS/XML")
    Rel(aggregator, openmeteo, "Получает прогноз", "JSON API")
    Rel(aggregator, noaa, "Получает Kp-индекс", "JSON API")
    Rel(aggregator, ner, "Извлекает сущности", "HTTP POST /extract")
    Rel(aggregator, browser, "Отправляет Web Push", "VAPID Protocol")
    
    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

---

## Level 2: Container Diagram

```mermaid
C4Container
    title Container Diagram — NewsAggregator

    Person(user, "Пользователь")
    Person(admin, "Администратор")
    
    Container_Boundary(c1, "NewsAggregator") {
        Container(spa, "SPA Frontend", "React 18.3 + TypeScript", "Лента, фильтры, детальные страницы, PWA")
        Container(api, "Backend API", "Node.js 20 + Express 4.21", "REST API, WebSocket, Web Push")
        Container(db, "Database", "PostgreSQL 17", "13 таблиц: статьи, источники, кластеры, погода")
        Container(cache, "Cache", "Redis 7", "Кэш ленты, API-ключи, rate limiting")
        Container(ner_service, "NER Service", "FastAPI + Natasha", "Извлечение сущностей, нормализация")
    }
    
    System_Ext(rss, "RSS-источники")
    System_Ext(openmeteo, "Open-Meteo API")
    System_Ext(browser_push, "Browser Push Service")
    
    Rel(user, spa, "Использует", "HTTPS")
    Rel(admin, spa, "Управляет", "HTTPS")
    Rel(spa, api, "Запросы", "JSON/HTTPS, WebSocket")
    Rel(api, db, "Читает/пишет", "SQL")
    Rel(api, cache, "Кэширует", "Redis Protocol")
    Rel(api, ner_service, "Извлекает сущности", "HTTP POST")
    Rel(api, rss, "Собирает", "RSS/XML")
    Rel(api, openmeteo, "Получает погоду", "JSON API")
    Rel(api, browser_push, "Отправляет push", "VAPID")
    
    UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="1")
```

---

## Level 3: Component Diagram — Backend API

```mermaid
C4Component
    title Component Diagram — Backend API

    Container_Boundary(api, "Backend API") {
        Component(routes, "API Routes", "Express Router", "Публичные и admin эндпоинты")
        Component(middleware, "Middleware", "Express Middleware", "Auth, rate limit, CORS, DDoS")
        
        Component(collect, "CollectNewsUseCase", "Application Layer", "Оркестрация сбора RSS")
        Component(cluster, "ClusterNewsUseCase", "Application Layer", "Кластеризация статей")
        Component(entity_cluster, "EntityClusterService", "Application Layer", "Поиск похожих по сущностям")
        Component(weather_job, "WeatherCollectionService", "Application Layer", "Сбор погоды")
        
        Component(rss_service, "RssCollectionService", "Infrastructure", "Сбор из источников")
        Component(rss_parser, "RssParser", "Infrastructure", "Парсинг RSS")
        Component(article_repo, "NewsArticleRepository", "Infrastructure", "Доступ к БД")
        Component(ner_client, "NerService", "Infrastructure", "HTTP-клиент NER")
        Component(cache_service, "QueryCacheService", "Infrastructure", "Двухуровневый кэш")
        Component(ws_manager, "WebSocketManager", "Infrastructure", "Real-time уведомления")
        Component(push_service, "WebPushService", "Infrastructure", "VAPID push")
        Component(eventbus, "EventBus", "Infrastructure", "Pub/Sub внутри процесса")
        
        Component(domain, "Domain Models", "Domain Layer", "NewsCluster, NewsArticle")
    }
    
    Container_Ext(db, "PostgreSQL")
    Container_Ext(redis, "Redis")
    Container_Ext(ner, "NER Service")
    System_Ext(rss_sources, "RSS-источники")
    System_Ext(openmeteo, "Open-Meteo")
    
    Rel(routes, middleware, "Проходит через")
    Rel(middleware, collect, "Вызывает")
    Rel(middleware, entity_cluster, "Вызывает")
    
    Rel(collect, rss_service, "Использует")
    Rel(rss_service, rss_parser, "Парсит через")
    Rel(rss_parser, rss_sources, "Запрашивает")
    
    Rel(collect, article_repo, "Сохраняет через")
    Rel(collect, ner_client, "Обогащает через")
    Rel(ner_client, ner, "HTTP POST")
    
    Rel(collect, eventbus, "Публикует события")
    Rel(eventbus, cluster, "Подписан на articles.collected")
    Rel(eventbus, cache_service, "Инвалидирует кэш")
    Rel(eventbus, ws_manager, "Уведомляет клиентов")
    Rel(eventbus, push_service, "Отправляет push")
    
    Rel(cluster, domain, "Использует правила")
    Rel(entity_cluster, article_repo, "Запрашивает")
    
    Rel(article_repo, db, "SQL")
    Rel(cache_service, redis, "Redis Protocol")
    Rel(weather_job, openmeteo, "HTTP GET")
    Rel(weather_job, article_repo, "Сохраняет")
    
    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

---

## Level 3: Component Diagram — Frontend SPA

```mermaid
C4Component
    title Component Diagram — Frontend SPA

    Container_Boundary(spa, "SPA Frontend") {
        Component(pages, "Pages", "React Components", "NewsFeed, NewsDetail, Weather, Monitor")
        Component(components, "UI Components", "React Components", "NewsCard, Filters, WeatherWidget")
        Component(hooks, "Custom Hooks", "React Hooks", "useWeatherData, usePushNotifications, useOnlineStatus")
        Component(store, "State Management", "Zustand", "Глобальное состояние фильтров")
        Component(router, "Router", "Wouter", "Клиентский роутинг")
        
        Component(offline_store, "offlineStore", "Service", "IndexedDB для офлайн-режима")
        Component(pending_actions, "pendingActionsService", "Service", "Очередь офлайн-действий")
        Component(weather_cache, "weatherCache", "Service", "Кэш погоды в IDB")
        Component(push_service_client, "push-service", "Service", "Web Push подписка")
        
        Component(sw, "Service Worker", "Workbox + Custom", "Precache, push, offline fallback")
        Component(idb, "IndexedDB", "Dexie.js", "articles, feedSlices, pendingActions, weather")
    }
    
    Container_Ext(api, "Backend API")
    System_Ext(browser_push, "Browser Push Service")
    
    Rel(pages, components, "Рендерит")
    Rel(pages, hooks, "Использует")
    Rel(pages, store, "Читает/пишет")
    Rel(router, pages, "Маршрутизирует")
    
    Rel(hooks, api, "Запрашивает", "fetch")
    Rel(hooks, offline_store, "Сохраняет/читает")
    Rel(hooks, weather_cache, "Кэширует погоду")
    Rel(hooks, push_service_client, "Управляет подпиской")
    
    Rel(offline_store, idb, "Dexie API")
    Rel(pending_actions, idb, "Dexie API")
    Rel(weather_cache, idb, "Dexie API")
    
    Rel(sw, idb, "Читает офлайн-данные")
    Rel(sw, browser_push, "Получает push")
    Rel(push_service_client, sw, "pushManager.subscribe")
    Rel(push_service_client, api, "POST /api/push/subscribe")
    
    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

---

## Deployment Diagram

```mermaid
graph TB
    subgraph "Production Server"
        subgraph "Docker Compose"
            nginx[Nginx<br/>Reverse Proxy<br/>SSL Termination]
            app[Node.js App<br/>PM2 Cluster<br/>Port 5000]
            postgres[(PostgreSQL 17<br/>Port 5432)]
            redis[(Redis 7<br/>Port 6379)]
            ner[NER Service<br/>FastAPI<br/>Port 8001]
        end
    end
    
    subgraph "External Services"
        rss_sources[RSS Sources<br/>Lenta, RBC, etc.]
        openmeteo[Open-Meteo API]
        noaa[NOAA Kp API]
    end
    
    subgraph "Client Devices"
        browser[Browser<br/>React SPA<br/>Service Worker<br/>IndexedDB]
    end
    
    browser -->|HTTPS| nginx
    nginx -->|Proxy Pass| app
    app -->|SQL| postgres
    app -->|Cache| redis
    app -->|HTTP| ner
    app -->|RSS/XML| rss_sources
    app -->|JSON API| openmeteo
    app -->|JSON API| noaa
    app -.->|Web Push| browser
    
    style nginx fill:#f9f,stroke:#333,stroke-width:2px
    style app fill:#bbf,stroke:#333,stroke-width:2px
    style postgres fill:#bfb,stroke:#333,stroke-width:2px
    style redis fill:#fbb,stroke:#333,stroke-width:2px
    style ner fill:#ffb,stroke:#333,stroke-width:2px
```

---

## Data Flow Summary

### Сбор новостей (каждые 2-10 минут)
1. **node-cron** → CollectNewsUseCase
2. RssCollectionService → RssParser → RSS-источники
3. ArticleManagementService → PostgreSQL (INSERT)
4. NerService → NER Service (POST /extract)
5. EventBus → ClusterNewsUseCase → кластеризация
6. EventBus → QueryCacheService → инвалидация Redis
7. EventBus → WebSocketManager → уведомление клиентов
8. EventBus → WebPushService → push-рассылка (если >= 5 статей)

### Чтение ленты
1. Browser → GET /api/news
2. apiKeyAuth → rate limit (120 req/мин без ключа)
3. QueryCacheService → Redis (TTL 300s)
4. При промахе: NewsArticleRepository → PostgreSQL
5. Ответ → Browser + сохранение в IndexedDB

### Офлайн-режим
1. Browser → fetch перехватывается Service Worker
2. Service Worker → IndexedDB (Dexie)
3. Возврат кэшированных данных
4. Реакции → pendingActions queue
5. При возврате онлайн → синхронизация с API

### Погода (каждые 3 часа)
1. node-cron → WeatherCollectionService
2. Open-Meteo API → 7 дней + 2 дня почасовки
3. NOAA API → Kp-индекс
4. PostgreSQL → UPSERT weather_forecasts
5. Browser → GET /api/weather/week → IndexedDB (TTL 1ч)

---

## Technology Stack

### Frontend
- **React 18.3.1** — UI framework
- **TypeScript 5.6.3** — type safety
- **Vite 6.3.5** — build tool
- **Wouter** — routing
- **Zustand** — state management
- **Dexie.js** — IndexedDB wrapper
- **Workbox** — Service Worker
- **@tanstack/react-virtual** — виртуализация ленты

### Backend
- **Node.js 20** — runtime
- **Express.js 4.21.2** — web framework
- **Drizzle ORM** — database access
- **express-ws** — WebSocket
- **web-push** — VAPID push
- **node-cron** — scheduler
- **Winston** — logging

### Infrastructure
- **PostgreSQL 17** — primary database
- **Redis 7** — cache + rate limiting
- **Nginx** — reverse proxy
- **PM2** — process manager
- **Docker + Docker Compose** — containerization

### External Services
- **FastAPI** — NER service
- **Natasha** — Russian NER
- **pymorphy2** — morphological analysis
- **Open-Meteo** — weather API
- **NOAA** — geomagnetic activity

---

> См. также: [DATA_FLOW.md](./DATA_FLOW.md), [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md), [MODULE_DEPENDENCIES.md](./MODULE_DEPENDENCIES.md)
