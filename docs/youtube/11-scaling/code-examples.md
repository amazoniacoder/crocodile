# Эпизод 11: Примеры кода из реального проекта

> Все примеры — реальный код из `server/infrastructure/cluster/`

---

## 1. DistributedScheduler — Redis NX Lock

**Файл:** `server/infrastructure/cluster/DistributedScheduler.ts`

### Захват блокировки

```typescript
async acquireLock(taskName: string): Promise<boolean> {
  const lockKey = `lock:rss:${taskName}`;
  const redis = await getRedisClient();

  if (!redis) {
    return true; // Fallback: single-node mode
  }

  const result = await redis.set(
    lockKey,
    this.nodeId,
    { PX: this.LOCK_TTL_MS, NX: true }  // NX = set if Not eXists
  );

  return result === 'OK';
}
```

**Что объяснить:**
- `NX` — атомарная операция, только один из N процессов получит `OK`
- `PX: 30000` — TTL 30 сек, защита от «мёртвых» блокировок
- Fallback `return true` — без Redis работает как single-node

### Освобождение через Lua-скрипт

```typescript
async releaseLock(taskName: string): Promise<boolean> {
  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;

  const result = await redis.eval(script, {
    keys: [lockKey],
    arguments: [this.nodeId]
  }) as number;

  return result === 1;
}
```

**Что объяснить:**
- Lua-скрипт выполняется атомарно — нет race condition
- Нода освобождает только свою блокировку (проверка `nodeId`)
- Без Lua: между GET и DEL другая нода могла захватить lock

### Heartbeat

```typescript
private async sendHeartbeat(): Promise<void> {
  const heartbeatData = {
    nodeId: this.nodeId,
    cpuUsage: ((cpuUsage.user + cpuUsage.system) / 1000000).toString(),
    memoryUsage: (memUsage.rss / 1024 / 1024).toString(),
    activeConnections: activeConnections.toString(),
    lastHeartbeat: Date.now().toString()
  };

  await redis.hSet(`heartbeat:${this.nodeId}`, heartbeatData);
  await redis.expire(`heartbeat:${this.nodeId}`, 45); // NODE_TIMEOUT_MS / 1000
}
```

**Что объяснить:**
- `nodeId = node-{pid}-{timestamp}` — уникален даже при рестарте
- TTL = 45 сек, heartbeat каждые 10 сек → 4.5x запас
- Данные используются `LoadBalancer` для выбора наименее загруженной ноды

---

## 2. LoadBalancer — Стратегии балансировки

**Файл:** `server/infrastructure/cluster/LoadBalancer.ts`

### Least-loaded стратегия

```typescript
class LeastLoadedStrategy implements LoadBalancingStrategy {
  selectNode(nodes: Array<{ nodeId: string; cpuUsage: number; memoryUsage: number }>): string | null {
    let bestNode = nodes[0];
    let bestScore = this.calculateLoadScore(bestNode);

    for (let i = 1; i < nodes.length; i++) {
      const score = this.calculateLoadScore(nodes[i]);
      if (score < bestScore) {
        bestScore = score;
        bestNode = nodes[i];
      }
    }

    return bestNode.nodeId;
  }

  private calculateLoadScore(node: { cpuUsage: number; memoryUsage: number }): number {
    return (node.cpuUsage * 0.7) + (node.memoryUsage / 1000 * 0.3);
  }
}
```

**Что объяснить:**
- CPU имеет вес 0.7 — более критичный ресурс для Node.js
- RAM в MB делится на 1000 для нормализации к той же шкале
- Данные берутся из heartbeat-ов в Redis

### Точка входа для RSS-сбора

```typescript
async shouldHandleCollection(taskType: 'fast' | 'slow'): Promise<boolean> {
  const isRedisAvailable = await distributedScheduler.isRedisAvailable();

  if (!isRedisAvailable) {
    return true; // Single-node fallback
  }

  const lockAcquired = taskType === 'fast'
    ? await distributedScheduler.shouldHandleFastSources()
    : await distributedScheduler.shouldHandleSlowSources();

  return lockAcquired;
}
```

**Что объяснить:**
- Вызывается из `CollectNewsUseCase` перед каждым циклом сбора
- Graceful degradation: без Redis — каждая нода работает самостоятельно
- `fast` и `slow` — два независимых расписания (разные locks)

---

## 3. HealthCheckManager — Определение статуса

**Файл:** `server/infrastructure/cluster/HealthCheckManager.ts`

### Логика статусов

```typescript
private determineHealthStatus(
  metrics: HealthMetrics['metrics'],
  services: HealthMetrics['services'],
  responseTime: number,
  errors: string[]
): HealthMetrics['status'] {
  // Критично: БД недоступна
  if (!services.database) return 'unhealthy';

  // Критично: слишком медленно
  if (responseTime > 5000) return 'unhealthy';

  // Критично: много ошибок
  if (errors.length > 2) return 'unhealthy';

  // Деградация: высокая нагрузка или Redis недоступен
  const memoryPercent = (metrics.memoryUsage / metrics.memoryTotal) * 100;
  if (metrics.cpuUsage > 80 || memoryPercent > 85 || !services.redis) {
    return 'degraded';
  }

  return 'healthy';
}
```

**Что объяснить:**
- Иерархия: `unhealthy` → failover, `degraded` → мониторинг, `healthy` → ок
- БД — единственный hard dependency (без неё нода бесполезна)
- Redis недоступность → `degraded`, не `unhealthy` (есть in-memory fallback)

### Хранение в Redis для видимости кластера

```typescript
private async storeHealthInRedis(health: HealthMetrics): Promise<void> {
  await redis.hSet(`health:${health.nodeId}`, {
    nodeId: health.nodeId,
    status: health.status,
    cpuUsage: health.metrics.cpuUsage.toString(),
    // ...
  });
  await redis.expire(`health:${health.nodeId}`, 60); // 1 минута TTL
}
```

**Что объяснить:**
- TTL 60 сек при проверке каждые 15 сек → 4x запас
- Любая нода может получить состояние всего кластера через `KEYS health:*`

---

## 4. FailoverController — Автоматический failover

**Файл:** `server/infrastructure/cluster/FailoverController.ts`

### Политика failover

```typescript
private policy: FailoverPolicy = {
  enabled: true,
  maxFailoversPerHour: 3,    // Rate limiting
  cooldownMinutes: 5,         // Пауза между failover-ами
  requiredHealthyNodes: 1,    // Минимум здоровых нод
  autoRecovery: true
};
```

**Что объяснить:**
- `maxFailoversPerHour: 3` — защита от failover-шторма (cascading failures)
- `cooldownMinutes: 5` — время на стабилизацию после failover
- Политику можно менять через `updatePolicy()` без рестарта

### Выбор целевой ноды

```typescript
private selectTargetNode(nodes: any[], excludeNodeId: string): string | null {
  const candidates = nodes.filter(n =>
    n.nodeId !== excludeNodeId &&
    (n.status === 'healthy' || n.status === 'degraded')
  );

  candidates.sort((a, b) => {
    const scoreA = this.calculateHealthScore(a);
    const scoreB = this.calculateHealthScore(b);
    return scoreA - scoreB;
  });

  return candidates[0]?.nodeId ?? null;
}

private calculateHealthScore(node: any): number {
  let score = 0;
  if (node.status === 'degraded') score += 10;
  score += node.metrics.cpuUsage * 0.1;
  score += (node.metrics.memoryUsage / node.metrics.memoryTotal) * 100 * 0.1;
  score += node.metrics.activeConnections * 0.01;
  return score;
}
```

**Что объяснить:**
- `degraded` нода получает штраф +10 — предпочитаем `healthy`
- Меньший score = лучший кандидат
- `degraded` всё равно принимается — лучше деградировавшая нода, чем никакой

### Уведомление WS-клиентов при failover

```typescript
private async transferConnections(fromNode: string, toNode: string): Promise<void> {
  await webSocketManager.broadcastToCluster({
    type: 'node_failover',
    data: {
      fromNode,
      toNode,
      action: 'reconnect_required',
      timestamp: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  });
}
```

**Что объяснить:**
- WebSocket-соединения нельзя «перенести» — клиент должен переподключиться
- Broadcast через Redis Pub/Sub → все ноды рассылают своим клиентам
- Клиент получает `reconnect_required` → автоматически переподключается

---

## 5. Graceful Shutdown

**Файл:** `server/infrastructure/cluster/DistributedScheduler.ts`

```typescript
constructor() {
  this.nodeId = `node-${process.pid}-${Date.now()}`;
  this.startHeartbeat();

  process.on('SIGINT', () => this.cleanup());
  process.on('SIGTERM', () => this.cleanup());
}

private async cleanup(): Promise<void> {
  if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

  const redis = await getRedisClient();
  if (!redis) return;

  // Удаляем heartbeat — нода сразу исчезает из кластера
  await redis.del(`heartbeat:${this.nodeId}`);

  // Освобождаем все locks
  const lockKeys = await redis.keys('lock:rss:*');
  for (const key of lockKeys) {
    const owner = await redis.get(key);
    if (owner === this.nodeId) {
      await redis.del(key);
    }
  }
}
```

**Что объяснить:**
- `SIGTERM` — штатная остановка (PM2 reload, Docker stop)
- `SIGINT` — Ctrl+C в dev-режиме
- Без cleanup: другие ноды ждут TTL (30-45 сек) перед захватом locks
- С cleanup: мгновенная передача задач

---

## Связь с остальным кодом

```typescript
// server/application/news/CollectNewsUseCase.ts
// (упрощённо — показать точку интеграции)

import { loadBalancer } from '../../infrastructure/cluster/LoadBalancer';

async collectFastSources(): Promise<void> {
  const shouldHandle = await loadBalancer.shouldHandleCollection('fast');
  if (!shouldHandle) return; // Другая нода уже собирает

  try {
    // ... сбор RSS ...
  } finally {
    await loadBalancer.releaseCollectionLock('fast');
  }
}
```

**Что объяснить:**
- `finally` — lock освобождается даже при ошибке
- Паттерн «try-finally для locks» — стандарт в distributed systems
