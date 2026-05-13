# Эпизод 11: «Масштабирование и кластер»

> **Длительность:** 20-25 минут  
> **Сложность:** Advanced  
> **Аудитория:** Senior-разработчики, архитекторы, DevOps

## Что покажем

Реальный production-код горизонтального масштабирования, уже встроенный в проект:

- `DistributedScheduler` — распределённые блокировки через Redis (NX + Lua)
- `LoadBalancer` — выбор ноды: round-robin и least-loaded
- `HealthCheckManager` — health-checks каждые 15 сек, статусы healthy/degraded/unhealthy
- `FailoverController` — автоматический failover с cooldown и rate-limit
- `WebSocketManager` — broadcast через Redis Pub/Sub между нодами

## Файлы эпизода

| Файл | Описание |
|------|----------|
| [script.md](./script.md) | Полный сценарий (25 мин) |
| [slides-outline.md](./slides-outline.md) | Структура слайдов |
| [diagrams-list.md](./diagrams-list.md) | Диаграммы для показа |
| [code-examples.md](./code-examples.md) | Реальный код проекта с пояснениями |
| [demo-scenarios.md](./demo-scenarios.md) | Сценарии live-демо |
| [cluster-config.md](./cluster-config.md) | Конфиги Nginx, Patroni, Redis |
| [monitoring-scripts.md](./monitoring-scripts.md) | Bash-скрипты мониторинга |
| [interactive-elements.md](./interactive-elements.md) | Вопросы, задания, CTA |
| [recording-preparation.md](./recording-preparation.md) | Чеклист перед записью |

## Ключевые файлы проекта

```
server/infrastructure/cluster/
├── DistributedScheduler.ts   # Redis NX locks + heartbeat
├── LoadBalancer.ts           # Round-robin / least-loaded
├── HealthCheckManager.ts     # Cluster health, failover trigger
├── FailoverController.ts     # Автоматический failover
└── WebSocketManager.ts       # Cross-node broadcast
```

## Связь с другими эпизодами

- **Эп. 3** (Backend RSS) — `LoadBalancer.shouldHandleCollection()` используется в `CollectNewsUseCase`
- **Эп. 8** (Мониторинг) — `HealthCheckManager` питает `AlertManager`
- **Эп. 10** (Deployment) — Docker Swarm для запуска кластера
