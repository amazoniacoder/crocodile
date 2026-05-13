# Эпизод 11: Сценарии демонстрации

## Демо 1 — Cluster Health API (2 мин)

**Когда:** После объяснения HealthCheckManager (слайд 10)  
**Что показываем:** Реальный ответ `/api/health` с данными кластера

```bash
curl http://localhost:5000/api/health | jq .
```

**Ожидаемый ответ:**
```json
{
  "status": "healthy",
  "cluster": {
    "totalNodes": 1,
    "activeNodes": 1,
    "currentNode": "node-12345-1748000000000",
    "isRedisAvailable": true,
    "nodes": [
      {
        "nodeId": "node-12345-1748000000000",
        "cpuUsage": 2.3,
        "memoryUsage": 145.2,
        "activeConnections": 3,
        "lastHeartbeat": "2025-05-23T10:00:00.000Z",
        "isCurrentNode": true
      }
    ]
  }
}
```

**Что объяснить:** Это данные из Redis heartbeat — любая нода кластера видит то же самое.

---

## Демо 2 — Redis Keys в реальном времени (3 мин)

**Когда:** После объяснения DistributedScheduler (слайд 7-8)  
**Что показываем:** Ключи в Redis во время работы приложения

```bash
# Подключаемся к Redis
redis-cli

# Смотрим heartbeat текущей ноды
KEYS heartbeat:*
HGETALL heartbeat:node-12345-1748000000000

# Смотрим locks во время RSS-сбора
KEYS lock:rss:*
GET lock:rss:fast-sources
GET lock:rss:slow-sources

# Health данные
KEYS health:*
HGETALL health:node-12345-1748000000000
```

**Что объяснить:**
- Показать как lock появляется и исчезает во время цикла сбора
- Показать TTL: `TTL lock:rss:fast-sources` → убывает от 30 до 0

---

## Демо 3 — Запуск двух нод локально (5 мин)

**Когда:** Центральное демо эпизода (слайд 7)  
**Что показываем:** Две ноды, только одна собирает RSS

**Терминал 1:**
```bash
PORT=5000 node dist/index.js
# Лог: 🔒 Lock acquired: fast-sources by node-1234-...
# Лог: 📰 Collecting fast sources...
# Лог: 🔓 Lock released: fast-sources
```

**Терминал 2:**
```bash
PORT=5001 node dist/index.js
# Лог: 🔒 Lock held by: node-1234-... for task: fast-sources
# Лог: ⏭️ Node node-5678-... skipping fast sources (handled by another node)
```

**Redis (Терминал 3):**
```bash
watch -n 1 'redis-cli KEYS "lock:rss:*" && redis-cli KEYS "heartbeat:*"'
```

**Что объяснить:** Видим 2 heartbeat-ключа, но только 1 lock — именно это и нужно.

---

## Демо 4 — Failover при остановке ноды (4 мин)

**Когда:** После объяснения FailoverController (слайд 11)  
**Что показываем:** Нода-1 останавливается, нода-2 подхватывает locks

**Шаги:**
1. Запустить 2 ноды (Демо 3)
2. Убедиться что нода-1 держит lock
3. Остановить ноду-1: `Ctrl+C` (SIGINT → cleanup)
4. Наблюдать в Redis: heartbeat:node-1 исчезает мгновенно
5. Нода-2 на следующем цикле захватывает lock

```bash
# Наблюдаем в реальном времени
watch -n 1 'redis-cli KEYS "heartbeat:*" | wc -l'
```

**Вариант без graceful shutdown (имитация краша):**
```bash
kill -9 <pid>  # SIGKILL — без cleanup
# Heartbeat исчезнет через 45 сек (TTL)
# Lock исчезнет через 30 сек (TTL)
```

**Что объяснить:** Разница между graceful stop и crash — время передачи задач.

---

## Демо 5 — Admin API кластера (2 мин)

**Когда:** Финал практической части  
**Что показываем:** Cluster health через admin API

```bash
TOKEN="your-admin-token"

# Состояние кластера
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/admin/cluster/health | jq .

# Failover история
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/admin/cluster/failovers | jq .

# Ручной failover (для демо)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/admin/cluster/failover \
  -d '{"nodeId": "node-1234-...", "reason": "demo"}' | jq .
```

---

## Порядок демо в эпизоде

| Время | Демо | Цель |
|-------|------|------|
| 6:00 | Демо 2 (Redis keys) | Показать структуру данных |
| 9:00 | Демо 3 (2 ноды) | Главное демо — distributed lock в действии |
| 14:00 | Демо 4 (failover) | Отказоустойчивость |
| 18:00 | Демо 1 + 5 (API) | Финальный обзор |
