# Эпизод 11: "Масштабирование и кластер" — Сценарий

> **Длительность:** 20-25 минут  
> **Цель:** Показать горизонтальное масштабирование от одного сервера до кластера  
> **Аудитория:** Архитекторы, Senior разработчики, DevOps инженеры

---

## 🎬 Структура эпизода

### 1. Интро (2 мин)
- От одного сервера к кластеру
- Проблемы роста нагрузки
- Что покажем: Load Balancer + Database Cluster + Redis Cluster

### 2. Теория масштабирования (5 мин)
- Вертикальное vs горизонтальное масштабирование
- Stateless архитектура
- Database sharding и replication
- Session management в кластере

### 3. Практика — Load Balancer (6 мин)
- Nginx upstream configuration
- Health checks и failover
- Sticky sessions для WebSocket

### 4. Практика — Database Cluster (8 мин)
- PostgreSQL Master-Slave replication
- Read/Write splitting
- Automatic failover с Patroni

### 5. Практика — Redis Cluster (4 мин)
- Redis Cluster setup
- Consistent hashing
- Failover scenarios

### 6. Заключение (2 мин)
- Архитектура финального кластера
- Метрики производительности
- Анонс следующего эпизода

---

## 📝 Детальный сценарий

### Интро

**[Экран: График роста нагрузки]**

Привет! Наш новостной агрегатор растет — с 1000 пользователей до 50000. Один сервер уже не справляется. В этом эпизоде покажу, как превратить монолитный деплой в отказоустойчивый кластер.

**[Экран: Архитектура "до" и "после"]**

Было: 1 сервер, все компоненты на одной машине  
Станет: 3+ серверов, load balancer, database cluster, автоматический failover

### Теория масштабирования

**[Экран: Диаграмма типов масштабирования]**

**Вертикальное масштабирование:**
- Увеличиваем CPU/RAM одного сервера
- Простое, но есть физические лимиты
- Single point of failure

**Горизонтальное масштабирование:**
- Добавляем больше серверов
- Бесконечное масштабирование
- Сложнее, но отказоустойчиво

**[Экран: Stateless vs Stateful]**

Ключевой принцип — **stateless приложения**:
- Сессии в Redis, не в памяти процесса
- Файлы в shared storage, не локально
- База данных — внешний сервис

### Практика: Load Balancer

**[Экран: `cluster-config.md` → раздел «Nginx Upstream»]**

Начнём с балансировщика нагрузки. Nginx распределяет запросы между инстансами — для API используем `least_conn`, для WebSocket — `ip_hash` (sticky sessions, иначе соединение рвётся).

**[Экран: `diagrams-list.md` → Диаграмма 7 — Nginx sticky sessions]**

Покажу, что происходит при отключении одного сервера — `proxy_next_upstream` автоматически перенаправляет запрос.

### Практика: Distributed Scheduler — главная часть

**[Экран: `code-examples.md` → раздел 1 «DistributedScheduler»]**

Вот где настоящая магия. Три ноды запущены одновременно — кто из них будет собирать RSS? Смотрим `acquireLock()` — Redis NX гарантирует что только одна нода получит `OK`.

**[Демо: `demo-scenarios.md` → Демо 3 «Два процесса»]**

Запускаем два процесса и смотрим в Redis — два heartbeat, один lock.

### Практика: Database Cluster

**[Экран: `cluster-config.md` → раздел «PostgreSQL Cluster with Patroni»]**

Для production нужна репликация PostgreSQL. Patroni управляет Master-Slave топологией и автоматически промотит Slave при падении Master. Конфиг смотрим в `cluster-config.md`.

**[Экран: `cluster-config.md` → раздел «HAProxy for PostgreSQL»]**

HAProxy разделяет write-трафик (порт 5000 → Master) и read-трафик (порт 5001 → Slaves).

### Практика: Redis и координация

**[Экран: `cluster-config.md` → раздел «Redis Cluster»]**

Redis в нашем проекте выполняет двойную роль: кэш и координатор кластера. Для production — Redis Cluster с 6 нодами (3 master + 3 replica) и consistent hashing по 16384 слотам.

### Заключение

**[Экран: Финальная архитектура кластера]**

Итоговая архитектура:
- **Load Balancer:** Nginx (2 ноды + keepalived)
- **App Servers:** 3 ноды с PM2 cluster
- **Database:** PostgreSQL Master + 2 Slaves с Patroni
- **Cache:** Redis Cluster (6 нод)
- **Coordination:** etcd cluster (3 ноды)

**[Экран: Метрики производительности]**

Результаты масштабирования:
- **RPS:** с 2,800 до 15,000+ (5x рост)
- **Latency:** стабильные 25-35ms
- **Availability:** 99.9% (автоматический failover)
- **Capacity:** поддержка 50,000+ одновременных пользователей

**[Экран: Анонс следующего эпизода]**

В финальном эпизоде подведем итоги всей серии, обсудим lessons learned и покажу roadmap развития проекта.

---

## 🎥 Материалы эпизода

> Все детали вынесены в отдельные файлы — сценарий содержит только тайминг и переходы.

| Что нужно | Файл |
|-----------|------|
| Диаграммы | [diagrams-list.md](./diagrams-list.md) |
| Код с пояснениями | [code-examples.md](./code-examples.md) |
| Конфиги Nginx / Patroni / Redis | [cluster-config.md](./cluster-config.md) |
| Сценарии демо | [demo-scenarios.md](./demo-scenarios.md) |
| Слайды | [slides-outline.md](./slides-outline.md) |
| Bash-скрипты мониторинга | [monitoring-scripts.md](./monitoring-scripts.md) |
| Подготовка к записи | [recording-preparation.md](./recording-preparation.md) |

---

## 📊 Ключевые метрики для демонстрации

### Производительность
- **Single server:** 2,800 RPS
- **3-node cluster:** 8,400 RPS
- **Latency:** 25-35ms (стабильно)

### Отказоустойчивость
- **App server failure:** 0s даунтайм (Nginx `proxy_next_upstream`)
- **Database failover:** 5-10s (Patroni promotion)
- **Redis node failure:** 0s (TTL + другая нода захватывает lock)
- **Load balancer failure:** 2-3s (keepalived VIP switch)