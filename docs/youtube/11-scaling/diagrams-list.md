# Эпизод 11: Диаграммы

## Диаграмма 1 — Эволюция архитектуры

```
МОНОЛИТ                          КЛАСТЕР
─────────────────                ─────────────────────────────────
┌─────────────────┐              ┌──────────┐    ┌──────────┐
│   Один сервер   │              │  Nginx   │    │  Nginx   │
│                 │              │  LB-1    │    │  LB-2    │
│  Node.js        │              └────┬─────┘    └────┬─────┘
│  PostgreSQL     │                   │  keepalived VIP│
│  Redis          │              ─────┴────────────────┘
└─────────────────┘                   │
                                 ┌────┴──────────────────┐
                              ┌──┴──┐  ┌─────┐  ┌─────┐
                              │App-1│  │App-2│  │App-3│
                              └──┬──┘  └──┬──┘  └──┬──┘
                                 └─────────┴─────────┘
                                           │
                              ┌────────────┴────────────┐
                           ┌──┴──┐     ┌─────┐     ┌─────┐
                           │ PG  │     │ PG  │     │ PG  │
                           │Master│    │Slave│     │Slave│
                           └─────┘     └─────┘     └─────┘
                                    Patroni + etcd
```

**Когда показывать:** Слайд 5, начало раздела «Практика»

---

## Диаграмма 2 — Distributed Lock (ключевая!)

```
Нода-1                    Redis                    Нода-2
  │                         │                         │
  │── SET lock:rss:fast ──→ │                         │
  │   nodeId-1, NX, PX:30s  │                         │
  │ ←── OK ─────────────── │                         │
  │                         │                         │
  │  [собирает RSS]         │── SET lock:rss:fast ──→ │
  │                         │   nodeId-2, NX, PX:30s  │
  │                         │ ←── nil ──────────────  │
  │                         │   [lock занят, пропуск] │
  │                         │                         │
  │── DEL lock:rss:fast ──→ │  (Lua: только если owner)
  │                         │                         │
```

**Когда показывать:** Слайд 7, объяснение `DistributedScheduler.acquireLock()`

---

## Диаграмма 3 — Heartbeat и обнаружение нод

```
Каждые 10 сек:

Нода-1 ──→ Redis: HSET heartbeat:node-1 {cpu, mem, ws, ts}
                  EXPIRE heartbeat:node-1 45

Нода-2 ──→ Redis: HSET heartbeat:node-2 {cpu, mem, ws, ts}
                  EXPIRE heartbeat:node-2 45

Нода-3 ──→ Redis: HSET heartbeat:node-3 {cpu, mem, ws, ts}
                  EXPIRE heartbeat:node-3 45

Нода-1 хочет узнать кластер:
  KEYS heartbeat:node-*  →  [node-1, node-2, node-3]
  Фильтр: lastHeartbeat < 45s назад
  Результат: 3 активные ноды
```

**Когда показывать:** Слайд 8

---

## Диаграмма 4 — Статусы здоровья

```
                    HealthCheckManager (каждые 15 сек)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         БД недоступна   CPU > 80%        Всё ок
         Response > 5s   Redis недоступен
              │               │               │
              ▼               ▼               ▼
         UNHEALTHY        DEGRADED         HEALTHY
              │
              ▼
     FailoverController
     (если cooldown прошёл)
```

**Когда показывать:** Слайд 10-11

---

## Диаграмма 5 — Failover Flow

```
HealthCheckManager
  │ обнаружил UNHEALTHY
  ▼
FailoverController.checkFailoverConditions()
  │
  ├── cooldown прошёл? (5 мин)
  ├── rate-limit не превышен? (3/час)
  └── нода держит ресурсы?
        │
        ▼ ДА
  selectTargetNode()  ←── сортировка по health score
        │
        ▼
  executeFailover()
    ├── releaseLocks()      → DEL lock:rss:* в Redis
    ├── transferConnections() → broadcastToCluster(reconnect)
    ├── recordFailoverEvent() → Redis list cluster:failovers
    └── notifyAdmin()       → Redis list admin:notifications
```

**Когда показывать:** Слайд 11

---

## Диаграмма 6 — WebSocket в кластере

```
Клиент-A          Нода-1           Redis           Нода-2          Клиент-B
   │                │               │                │                │
   │── WS connect ─→│               │                │                │
   │                │               │                │── WS connect ─→│
   │                │               │                │                │
   │  Новая статья  │               │                │                │
   │  появилась на  │               │                │                │
   │  Ноде-2        │               │                │                │
   │                │               │←─ PUBLISH ─────│                │
   │                │               │  new_articles  │                │
   │                │←─ SUBSCRIBE ──│                │                │
   │                │  получил      │                │                │
   │←─ WS message ──│               │                │── WS message ─→│
   │  "2 новых"     │               │                │  "2 новых"     │
```

**Когда показывать:** Слайд 12

---

## Диаграмма 7 — Nginx sticky sessions для WebSocket

```
Клиент (IP: 1.2.3.4)
        │
        ▼
   Nginx (ip_hash)
        │
        │  hash(1.2.3.4) % 3 = 1
        ▼
      Нода-1  ←── всегда эта нода для данного IP
        │
        │  WebSocket соединение сохраняется
```

**Когда показывать:** Слайд 13

---

## Диаграмма 8 — Финальная архитектура кластера

```
Internet
    │
    ▼
[VIP: 10.0.0.100]
    │
┌───┴───────────────┐
│  Nginx LB-1       │  keepalived MASTER
│  10.0.0.10        │
└───────────────────┘
┌───────────────────┐
│  Nginx LB-2       │  keepalived BACKUP
│  10.0.0.11        │
└───────────────────┘
    │
    ├──────────────────────────────┐
    │                              │
┌───┴───┐  ┌───────┐  ┌───────┐   │
│ App-1 │  │ App-2 │  │ App-3 │   │
│ :5000 │  │ :5000 │  │ :5000 │   │
└───┬───┘  └───┬───┘  └───┬───┘   │
    └──────────┴──────────┘        │
               │                   │
    ┌──────────┴──────────┐        │
    │                     │        │
┌───┴───┐  ┌───────┐  ┌──┴────┐   │
│  PG   │  │  PG   │  │  PG   │   │
│Master │  │Slave-1│  │Slave-2│   │
│:5432  │  │ :5432 │  │ :5432 │   │
└───────┘  └───────┘  └───────┘   │
        Patroni + etcd             │
                                   │
┌──────────────────────────────────┘
│  Redis (координация + кэш)
│  heartbeat:*, lock:rss:*, health:*
│  cluster:failovers, admin:notifications
└──────────────────────────────────
```

**Когда показывать:** Слайд 14-15, финал эпизода
