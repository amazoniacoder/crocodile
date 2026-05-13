# Эпизод 11: Интерактивные элементы

## Вопросы к аудитории

### В начале эпизода (вовлечение)
> «Кто из вас уже сталкивался с проблемой масштабирования? Напишите в комментариях — сколько пользователей было, когда сервер начал падать?»

### После объяснения NX Lock (слайд 7)
> «Как думаете — что произойдёт, если Redis упадёт в момент, когда нода держит lock? Ответ покажу через 2 минуты.»  
*(Ответ: TTL 30 сек → lock автоматически исчезнет, другая нода захватит)*

### После Lua-скрипта
> «Почему нельзя просто сделать GET + DEL вместо Lua? Кто знает — пишите в комментарии.»  
*(Ответ: race condition — между GET и DEL другая нода может захватить lock)*

---

## Домашние задания

### Уровень 1 (Junior)
Запустить два экземпляра приложения локально и убедиться, что только один собирает RSS:
```bash
PORT=5000 npm start &
PORT=5001 npm start &
redis-cli KEYS "lock:rss:*"
```

### Уровень 2 (Middle)
Изменить стратегию балансировки с `least-loaded` на `round-robin` в `LoadBalancer.ts` и сравнить поведение при неравномерной нагрузке.

### Уровень 3 (Senior)
Реализовать `WeightedRoundRobinStrategy` — round-robin с учётом весов нод (вес = обратная нагрузка). Добавить тест в `__tests__/`.

---

## Карточки с ключевыми концепциями

### Карточка: Redis NX
```
SET key value NX PX 30000

NX = set if Not eXists
PX = expire in milliseconds

Атомарная операция — гарантия что
только ОДИН процесс получит OK
```

### Карточка: Lua в Redis
```
Lua-скрипт выполняется атомарно.
Нет race condition между командами.

Паттерн: проверить владельца → удалить
Без Lua: GET → [другой процесс захватил] → DEL чужого lock
```

### Карточка: Heartbeat TTL
```
Heartbeat каждые 10 сек
TTL = 45 сек

Запас = 4.5x
Нода считается мёртвой если
нет heartbeat > 45 сек
```

---

## Call-to-Action

### В конце эпизода
> «Весь код из этого эпизода — в репозитории, ссылка в описании. Если хотите увидеть как это работает в production с реальными метриками — ставьте лайк, в следующем эпизоде подведём итоги всей серии.»

### Pinned comment
```
📌 Ключевые файлы эпизода:
• server/infrastructure/cluster/DistributedScheduler.ts
• server/infrastructure/cluster/LoadBalancer.ts
• server/infrastructure/cluster/HealthCheckManager.ts
• server/infrastructure/cluster/FailoverController.ts

🔗 GitHub: https://github.com/Chucha-blog/blogpro
```

---

## Тайм-коды для описания

```
00:00 — Введение: проблема масштабирования
02:00 — Вертикальное vs горизонтальное
04:00 — Архитектура кластера
06:00 — DistributedScheduler: Redis NX Lock
09:00 — ДЕМО: два процесса, один lock
11:00 — LoadBalancer: least-loaded стратегия
13:00 — HealthCheckManager: статусы нод
15:00 — FailoverController: автоматический failover
17:00 — WebSocket в кластере: Redis Pub/Sub
19:00 — Nginx: HTTP и WebSocket балансировка
21:00 — Метрики и итоги
23:00 — Анонс финального эпизода
```
