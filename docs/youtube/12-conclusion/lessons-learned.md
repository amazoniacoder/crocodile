# Эпизод 12: Архитектурные решения и выводы

> Честный разбор — что сработало, что нет, что изменил бы сейчас

---

## 5 ключевых решений

### 1. EventBus — слабая связь между слоями
**ADR:** [adr/0001-event-bus-architecture.md](../../adr/0001-event-bus-architecture.md)

**Решение:** `CollectNewsUseCase` публикует `ArticlesCollected`, не вызывая `ClusterNewsUseCase` напрямую.

**Почему сработало:**
- Добавление нового обработчика (например, Web Push) — это новый subscriber, не изменение существующего кода
- Тестирование UseCase изолированно — мокаем EventBus, не весь граф зависимостей
- Порядок обработки не важен — кластеризация и push-уведомления независимы

**Файлы:**
- `server/domain/events/ArticlesCollected.ts`
- `server/infrastructure/events/EventBus.ts`
- `server/application/news/subscribers.ts`

---

### 2. Drizzle ORM — SQL-first типизация
**ADR:** [adr/0002-drizzle-orm.md](../../adr/0002-drizzle-orm.md)

**Решение:** Drizzle вместо Prisma или TypeORM.

**Почему сработало:**
- Схема — это TypeScript, типы генерируются из неё автоматически
- Запросы читаются как SQL — нет магии, нет скрытых JOIN
- Миграции через `drizzle-kit generate` — детерминированы и версионируемы
- Нет runtime overhead от ORM-абстракций

**Что бы изменил:** Добавить query builder для сложных аналитических запросов — сейчас они пишутся как raw SQL строки.

---

### 3. Redis NX Lock — distributed coordination
**Файл:** `server/infrastructure/cluster/DistributedScheduler.ts`

**Решение:** `SET key nodeId NX PX 30000` + Lua-скрипт для освобождения.

**Почему сработало:**
- Атомарность NX — гарантия что ровно одна нода получит lock
- TTL 30 сек — защита от «мёртвых» блокировок при краше ноды
- Lua-скрипт — атомарная проверка владельца перед удалением, нет race condition
- Fallback `return true` — без Redis работает как single-node, не падает

**Что бы изменил:** Заменить `redis.keys('lock:rss:*')` на `redis.scan()` — `KEYS` блокирует Redis при большом количестве ключей.

---

### 4. Двухуровневый кэш — Redis → in-memory
**ADR:** [adr/0004-redis-cache-strategy.md](../../adr/0004-redis-cache-strategy.md)

**Решение:** Тегированная инвалидация, fallback на in-memory при недоступности Redis.

**Почему сработало:**
- Приложение не падает при недоступности Redis — деградирует, но работает
- Тегированная инвалидация — `invalidateByTag('articles')` сбрасывает все связанные ключи одной операцией
- In-memory fallback не требует изменений в коде потребителей кэша

**Файл:** `server/middleware/advancedCache.ts`

---

### 5. Wouter — минималистичный роутинг
**ADR:** [adr/0008-wouter-routing.md](../../adr/0008-wouter-routing.md)

**Решение:** Wouter (2 KB) вместо React Router (50 KB).

**Почему сработало:**
- API идентичен React Router для базовых случаев — миграция тривиальна
- Нет лишних абстракций для SPA с 10 маршрутами
- Bundle size имеет значение для PWA — каждый KB влияет на Time to Interactive

**Что бы изменил:** При росте до 30+ маршрутов с вложенными layouts — React Router оправдан.

---

## Что изменил бы сейчас

### Критично для production при масштабировании

**`KEYS` → `SCAN` в Redis**

Текущий код в `DistributedScheduler.ts` и `FailoverController.ts`:
```typescript
// ❌ Блокирует Redis при N > 10000 ключей
const lockKeys = await redis.keys('lock:rss:*');
```

Правильно:
```typescript
// ✅ Итеративный, не блокирует
async function* scanKeys(pattern: string) {
  let cursor = 0;
  do {
    const [next, keys] = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
    cursor = parseInt(next);
    yield* keys;
  } while (cursor !== 0);
}
```

**Read/Write splitting для PostgreSQL**

Сейчас все запросы идут на один инстанс. При наличии Patroni-кластера читающие запросы (`SELECT`) можно направить на Slaves через HAProxy (порт 5001 — уже описан в `11-scaling/cluster-config.md`).

### Важно для observability

**Grafana дашборд**

`PrometheusMetrics` (`server/infrastructure/monitoring/PrometheusMetrics.ts`) собирает метрики, но нет готового `grafana-dashboard.json`. Новый разработчик настраивает с нуля.

**Distributed tracing**

Сейчас: логи с `requestId` в Winston. Нельзя отследить запрос через все слои (API → UseCase → Repository → DB).  
Нужно: OpenTelemetry с Jaeger или Tempo — correlation ID через весь стек.

### Некритично, но улучшает DX

**OpenAPI документация**

Сейчас API документируется в `DEVELOPER_GUIDE.md` вручную. `zod-to-openapi` позволит генерировать Swagger из существующих Zod-схем валидации.

**Интеграционные тесты кластера**

`FailoverController` и `DistributedScheduler` покрыты unit-тестами с моками Redis. Нет тестов, которые поднимают реальный Redis и проверяют поведение двух нод.

---

## Что сработало лучше, чем ожидалось

**Graceful degradation везде.** Изначально это было требованием только для Redis. В итоге паттерн распространился на NER-сервис (fallback на токенную кластеризацию), на Web Push (fallback на WebSocket), на IndexedDB (fallback на обычный fetch). Система устойчива к частичным отказам.

**DDD границы.** Ни разу не возникло ситуации «куда положить этот код». Domain не знает об Express, Application не знает о PostgreSQL. Это кажется очевидным, но на практике требует дисциплины.

**TypeScript строгость.** `strict: true` в `tsconfig.json` поймал несколько реальных багов на этапе компиляции — особенно в работе с nullable полями из БД.
