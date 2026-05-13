# Диаграммы потоков данных

> Версия: 1.0  
> Создан: Май 2025

---

## 1. RSS сбор → сохранение → NER → EventBus

```mermaid
sequenceDiagram
    participant Cron as node-cron
    participant UColl as CollectNewsUseCase
    participant RSS as RssCollectionService
    participant Parser as RssParser
    participant AMS as ArticleManagementService
    participant DB as PostgreSQL
    participant NER as NER Service (FastAPI)
    participant EB as EventBus

    Cron->>UColl: trigger (fast/slow interval)
    UColl->>RSS: collectFromAllSources()
    
    loop Каждый источник (500ms delay)
        RSS->>Parser: parse(rssUrl)
        Parser->>Parser: strict mode
        alt Parse failed
            Parser->>Parser: lenient mode + sanitize
        end
        Parser-->>RSS: articles[]
    end
    
    RSS-->>UColl: collected articles
    UColl->>AMS: persistArticles(articles)
    AMS->>DB: INSERT ... ON CONFLICT DO NOTHING
    DB-->>AMS: insertedCount
    
    alt insertedCount > 0
        AMS->>NER: POST /extract (batch 10)
        NER-->>AMS: entities {PER, ORG, LOC}
        AMS->>DB: UPDATE articles SET entities
    end
    
    AMS-->>UColl: {insertedCount, duplicateCount}
    UColl->>EB: emit('articles.collected', stats)
```

---

## 2. EventBus → кластеризация → инвалидация кэша → уведомления

```mermaid
sequenceDiagram
    participant EB as EventBus
    participant Cluster as ClusterNewsUseCase
    participant Entity as EntityClusterService
    participant Cache as QueryCacheService
    participant WS as WebSocketManager
    participant Push as WebPushService
    participant DB as PostgreSQL

    EB->>Cluster: on('articles.collected')
    Cluster->>DB: SELECT articles WHERE cluster_id IS NULL
    Cluster->>NER: POST /normalize (batch titles)
    NER-->>Cluster: normalized tokens[]
    
    loop Бакеты region:category
        Cluster->>Cluster: areSimilarNormalized (threshold 0.6)
        alt Группа >= 2 статей
            Cluster->>DB: INSERT news_clusters
            Cluster->>DB: UPDATE articles SET cluster_id
        end
    end
    
    Cluster->>EB: emit('cluster.updated')
    
    par Параллельные подписчики
        EB->>Cache: invalidateByTags(['news', 'clusters'])
        Cache->>Cache: clear Redis + in-memory
        
        EB->>WS: broadcastToCluster('news_updated')
        WS->>WS: send to all connected clients
        
        alt insertedCount >= PUSH_THRESHOLD
            EB->>Push: broadcast(title, body)
            Push->>DB: SELECT * FROM push_subscriptions
            loop Батчи по 100
                Push->>Push: webpush.sendNotification()
                alt 410 or 404
                    Push->>DB: DELETE subscription
                end
            end
        end
    end
```

---

## 3. GET /api/news → кэш → БД → ответ

```mermaid
sequenceDiagram
    participant Client as Browser
    participant MW as apiKeyAuth
    participant Cache as QueryCacheService
    participant Redis as Redis
    participant Mem as In-Memory Cache
    participant Repo as NewsArticleRepository
    participant DB as PostgreSQL

    Client->>MW: GET /api/news?region=russia&category=tech
    
    alt С API-ключом
        MW->>MW: validate key, rate limit from DB
    else Без ключа
        MW->>MW: rate limit 120 req/min by IP
    end
    
    MW->>Cache: middleware (TTL 300s, tag 'news')
    Cache->>Redis: GET cache_key
    
    alt Cache hit (Redis)
        Redis-->>Cache: cached response
        Cache-->>Client: 200 OK (X-Cache: HIT)
    else Cache miss (Redis)
        Cache->>Mem: GET cache_key
        alt Cache hit (Memory)
            Mem-->>Cache: cached response
            Cache-->>Client: 200 OK (X-Cache: HIT-MEMORY)
        else Cache miss (Memory)
            Cache->>Repo: findMany(filters)
            Repo->>DB: SELECT with filters, pagination
            DB-->>Repo: articles[]
            Repo-->>Cache: articles[]
            Cache->>Redis: SET cache_key (TTL 300s)
            Cache->>Mem: SET cache_key (TTL 300s)
            Cache-->>Client: 200 OK (X-Cache: MISS)
        end
    end
```

---

## 4. Детальная страница → Entity-поиск → Cluster fallback → Category fallback

```mermaid
flowchart TD
    A[GET /api/news/:id] --> B[EntityClusterService.findSimilarArticles]
    B --> C{Статья имеет entities?}
    
    C -->|Да| D[Шаг 1: Entity-поиск]
    D --> E[Извлечь все термины из PER + ORG + LOC]
    E --> F[SELECT WHERE published_at >= NOW - 48h]
    F --> G[Фильтр: совпадение >= 2 терминов ILIKE]
    G --> H{Найдено >= 1?}
    
    H -->|Да| I[Вернуть все найденные без лимита]
    I --> Z[Ответ клиенту]
    
    H -->|Нет| J[Шаг 2: Cluster fallback]
    C -->|Нет| J
    
    J --> K{Статья имеет cluster_id?}
    K -->|Да| L[SELECT WHERE cluster_id = X]
    L --> M{Найдено >= 1?}
    M -->|Да| N[Вернуть статьи кластера без лимита]
    N --> Z
    
    M -->|Нет| O[Шаг 3: Category fallback]
    K -->|Нет| O
    
    O --> P[SELECT WHERE category = Y AND region = Z]
    P --> Q[ORDER BY published_at DESC LIMIT 3]
    Q --> R[Вернуть в отдельном блоке 'Другие новости']
    R --> Z
```

---

## 5. Погода: cron → Open-Meteo → БД → API → клиент → IndexedDB

```mermaid
sequenceDiagram
    participant Cron as node-cron (3h)
    participant Job as WeatherCollectionService
    participant OM as Open-Meteo API
    participant Noaa as NOAA Kp API
    participant Moon as MoonPhaseCalculator
    participant DB as PostgreSQL
    participant Client as Browser
    participant API as GET /api/weather/week
    participant Cache as advancedCache
    participant IDB as IndexedDB (Dexie)
    participant SW as Service Worker

    Cron->>Job: trigger every 3 hours
    
    loop 51 город
        Job->>OM: fetchForecast(lat, lon) — 7 дней
        OM-->>Job: daily forecast
        Job->>OM: fetchHourlyRange(lat, lon, dates) — 2 дня
        OM-->>Job: hourly forecast
        Job->>Noaa: fetchKpIndex()
        Noaa-->>Job: kp_index[]
        Job->>Moon: calculate(date)
        Moon-->>Job: phase, illumination
        
        Job->>DB: UPSERT weather_forecasts
        Job->>DB: UPSERT weather_hourly_forecasts
    end
    
    Job->>Cache: invalidate('weather:*')
    
    Note over Client,API: Пользователь открывает /weather
    
    Client->>API: GET /api/weather/week?locationId=1
    API->>Cache: check cache (TTL 3600s)
    
    alt Cache hit
        Cache-->>API: cached data
    else Cache miss
        API->>DB: SELECT forecasts + hourly
        DB-->>API: 7 days data
        API->>Cache: store (TTL 3600s)
    end
    
    API-->>Client: JSON response
    Client->>IDB: saveWeekForecast(locationId, data)
    IDB-->>Client: stored (TTL 1h)
    
    Note over Client,SW: Пользователь переходит в офлайн
    
    Client->>API: GET /api/weather/week?locationId=1
    API->>SW: fetch intercepted
    SW->>IDB: loadWeekForecast(locationId)
    IDB-->>SW: cached data
    SW-->>Client: Response from cache
```

---

## 6. Web Push: подписка → рассылка → уведомление

```mermaid
sequenceDiagram
    participant Client as Browser
    participant SW as Service Worker
    participant API as POST /api/push/subscribe
    participant DB as PostgreSQL
    participant Cron as RSS Collection
    participant Push as WebPushService
    participant VAPID as Web Push Protocol

    Note over Client,SW: Пользователь разрешает уведомления
    
    Client->>SW: navigator.serviceWorker.ready
    SW->>SW: pushManager.subscribe(VAPID_PUBLIC_KEY)
    SW-->>Client: subscription {endpoint, keys}
    Client->>API: POST /api/push/subscribe
    API->>DB: INSERT push_subscriptions
    DB-->>API: success
    API-->>Client: 200 OK
    
    Note over Cron,Push: Сбор новостей завершён
    
    Cron->>Push: insertedCount >= PUSH_THRESHOLD
    Push->>DB: SELECT * FROM push_subscriptions
    DB-->>Push: subscriptions[]
    
    loop Батчи по 100
        Push->>VAPID: webpush.sendNotification(subscription, payload)
        
        alt Success
            VAPID-->>Push: 201 Created
        else 410 Gone or 404 Not Found
            VAPID-->>Push: error
            Push->>DB: DELETE subscription
        end
    end
    
    Note over Client,SW: Браузер получает push
    
    VAPID->>SW: push event
    SW->>SW: showNotification(title, body, icon)
    SW-->>Client: Notification displayed
    
    Client->>SW: notificationclick
    SW->>Client: clients.openWindow('/')
```

---

## 7. Офлайн-режим: сохранение → чтение → синхронизация

```mermaid
sequenceDiagram
    participant Client as React App
    participant API as /api/news
    participant Store as offlineStore
    participant IDB as IndexedDB (Dexie)
    participant Pending as pendingActionsService
    participant Online as useOnlineStatus

    Note over Client,IDB: Пользователь онлайн, скроллит ленту
    
    Client->>API: GET /api/news?page=1
    API-->>Client: articles[]
    Client->>Store: saveFeedSlice(filters, articles)
    Store->>IDB: articles.bulkPut()
    Store->>IDB: feedSlices.put({filters, articleIds})
    IDB-->>Store: saved
    
    Note over Client,Online: Пользователь переходит в офлайн
    
    Online->>Online: navigator.onLine = false
    Online->>Client: setIsOnline(false)
    Client->>Client: показать жёлтый индикатор
    
    Client->>API: GET /api/news?page=1
    API-->>Client: Network error
    Client->>Store: loadFeedSlice(filters)
    Store->>IDB: feedSlices.get(filterKey)
    IDB-->>Store: {articleIds}
    Store->>IDB: articles.bulkGet(articleIds)
    IDB-->>Store: articles[]
    Store-->>Client: cached articles
    
    Note over Client,Pending: Пользователь ставит лайк офлайн
    
    Client->>Pending: addPendingReaction(articleId, 'like')
    Pending->>IDB: pendingActions.add({type, articleId, data})
    IDB-->>Pending: queued
    Pending-->>Client: optimistic update
    
    Note over Client,Online: Пользователь возвращается онлайн
    
    Online->>Online: navigator.onLine = true
    Online->>Client: setIsOnline(true)
    Client->>Client: показать зелёный индикатор
    
    Client->>Pending: processPendingActions()
    Pending->>IDB: pendingActions.toArray()
    IDB-->>Pending: actions[]
    
    loop Каждое действие
        Pending->>API: POST /api/news/:id/react
        alt Success
            API-->>Pending: 200 OK
            Pending->>IDB: pendingActions.delete(id)
        else Error
            API-->>Pending: 4xx/5xx
            Pending->>Pending: retry later
        end
    end
```

---

## Легенда

### Компоненты

- **Cron** — node-cron планировщик
- **CollectNewsUseCase** — оркестрация сбора
- **RssCollectionService** — сбор из источников
- **RssParser** — парсинг RSS (strict/lenient)
- **ArticleManagementService** — сохранение + NER
- **ClusterNewsUseCase** — кластеризация
- **EntityClusterService** — поиск похожих по сущностям
- **QueryCacheService** — двухуровневый кэш (Redis + Memory)
- **WebSocketManager** — real-time уведомления
- **WebPushService** — VAPID push-рассылка
- **NewsArticleRepository** — доступ к БД
- **apiKeyAuth** — rate limiting middleware
- **offlineStore** — IndexedDB для офлайн-режима
- **pendingActionsService** — очередь офлайн-действий

### Ключевые решения

1. **Дедупликация по URL** — `ON CONFLICT DO NOTHING` в БД
2. **Батчинг NER** — по 10 заголовков за запрос
3. **Двухуровневый кэш** — Redis → Memory fallback
4. **Тегированная инвалидация** — по событиям EventBus
5. **Entity-first поиск** — 48ч окно, минимум 2 совпадения
6. **Cluster fallback** — если entity-поиск пустой
7. **Category fallback** — 3 статьи из той же категории
8. **Push батчи** — по 100 подписок, автоудаление 410/404
9. **Офлайн GC** — TTL 14 дней, лимит 3000 статей
10. **Погода кэш** — 1 час TTL в IDB, 7 дней GC

---

> См. также: [ARCHITECTURE.md](../ARCHITECTURE.md), [CLUSTERING_GUIDE.md](../CLUSTERING_GUIDE.md), [NER_SERVICE_GUIDE.md](../NER_SERVICE_GUIDE.md)
