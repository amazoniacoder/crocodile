# Эпизод 11: Подготовка к записи

## Чеклист окружения

### Приложение
- [ ] `npm run build` — успешная сборка
- [ ] `.env` настроен: `DATABASE_URL`, `REDIS_URL`, `ADMIN_TOKEN`
- [ ] БД запущена и мигрирована: `npx drizzle-kit migrate`
- [ ] Redis запущен: `redis-cli ping` → `PONG`
- [ ] Приложение стартует: `npm start` → порт 5000

### Для Демо 3 (два процесса)
- [ ] Два терминала открыты рядом (split screen)
- [ ] Третий терминал для `redis-cli`
- [ ] Команды заготовлены в буфере обмена

### Инструменты
- [ ] `redis-cli` установлен
- [ ] `jq` установлен (для форматирования JSON)
- [ ] `watch` доступен (или аналог на Windows: `while ($true) { ...; Start-Sleep 1 }`)
- [ ] Браузер открыт на `http://localhost:5000`

---

## Раскладка экрана

### Основная запись
```
┌─────────────────────────────────────────┐
│                                         │
│         VS Code / IDE                   │
│    (код из infrastructure/cluster/)     │
│                                         │
└─────────────────────────────────────────┘
```

### Демо-сцены (split)
```
┌──────────────────┬──────────────────────┐
│   Терминал 1     │    Терминал 2        │
│   (нода :5000)   │    (нода :5001)      │
├──────────────────┴──────────────────────┤
│              Терминал 3                 │
│         (redis-cli watch)               │
└─────────────────────────────────────────┘
```

---

## Порядок открытия файлов в IDE

1. `server/infrastructure/cluster/DistributedScheduler.ts` — открыть первым
2. `server/infrastructure/cluster/LoadBalancer.ts`
3. `server/infrastructure/cluster/HealthCheckManager.ts`
4. `server/infrastructure/cluster/FailoverController.ts`
5. `server/infrastructure/cluster/WebSocketManager.ts`

**Закладки (строки для быстрого перехода):**
- `DistributedScheduler.ts:40` — `acquireLock()`
- `DistributedScheduler.ts:65` — Lua-скрипт
- `DistributedScheduler.ts:120` — `sendHeartbeat()`
- `LoadBalancer.ts:25` — `LeastLoadedStrategy`
- `HealthCheckManager.ts:155` — `determineHealthStatus()`
- `FailoverController.ts:95` — `shouldTriggerFailover()`

---

## Команды для быстрой вставки

```bash
# Запуск ноды 1
PORT=5000 node dist/index.js 2>&1 | grep -E "(Lock|Heartbeat|Collecting|Error)"

# Запуск ноды 2
PORT=5001 node dist/index.js 2>&1 | grep -E "(Lock|Heartbeat|Collecting|Error)"

# Redis мониторинг
redis-cli --scan --pattern "lock:rss:*"
redis-cli --scan --pattern "heartbeat:*"

# Health API
curl -s http://localhost:5000/api/health | jq .cluster

# Admin cluster
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/admin/cluster/health | jq .
```

---

## Возможные проблемы и решения

| Проблема | Решение |
|----------|---------|
| Порт 5001 занят | `netstat -ano \| findstr :5001` → kill PID |
| Redis не отвечает | `redis-server --daemonize yes` |
| Lock не освобождается | `redis-cli DEL lock:rss:fast-sources` |
| Нода не видит другую | Проверить что обе используют один Redis URL |
| `watch` нет на Windows | PowerShell: `while ($true) { redis-cli KEYS "lock:rss:*"; Start-Sleep 1; cls }` |

---

## Хронометраж записи

| Блок | Длительность | Примечание |
|------|-------------|------------|
| Интро + проблема | 2 мин | Без демо |
| Теория масштабирования | 3 мин | Слайды 3-5 |
| DistributedScheduler | 4 мин | Код + Демо 2 |
| Демо 3 (два процесса) | 4 мин | Ключевое демо |
| LoadBalancer | 2 мин | Код |
| HealthCheckManager | 2 мин | Код + слайд |
| FailoverController | 3 мин | Код + Демо 4 |
| WebSocket + Nginx | 2 мин | Слайды |
| Метрики + итог | 2 мин | Слайды 14-15 |
| **Итого** | **24 мин** | |
