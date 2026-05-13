# Эпизод 12: Структура слайдов

---

## Слайд 1 — Титульный (0:00)
**Заголовок:** «Итоги и следующие шаги»  
**Подзаголовок:** 12 эпизодов — один проект — production  
**Визуал:** Финальная архитектурная диаграмма кластера (из `11-scaling/diagrams-list.md` → Диаграмма 8)

---

## Слайд 2 — Карта серии (1:30)
**Заголовок:** Что мы построили за 12 эпизодов

```
Эп. 1  → Обзор и демо          Эп. 7  → Безопасность
Эп. 2  → DDD архитектура       Эп. 8  → Мониторинг
Эп. 3  → RSS сбор              Эп. 9  → База данных
Эп. 4  → Frontend React        Эп. 10 → Deployment
Эп. 5  → AI кластеризация      Эп. 11 → Масштабирование
Эп. 6  → PWA офлайн            Эп. 12 → Итоги ← вы здесь
```

**Визуал:** Сетка 2×6, текущий эпизод выделен, остальные с галочками

---

## Слайд 3 — DDD слои (2:30)
**Заголовок:** Архитектура, которая держит всё вместе

```
┌─────────────────────────────────────┐
│  API (Express routes)               │
├─────────────────────────────────────┤
│  Application (UseCases, Services)   │
├─────────────────────────────────────┤
│  Domain (Entities, Repositories)    │
├─────────────────────────────────────┤
│  Infrastructure (DB, Redis, RSS)    │
└─────────────────────────────────────┘
         ↕ EventBus (слабая связь)
```

**Визуал:** Цветные слои, стрелка EventBus сбоку

---

## Слайд 4 — PWA + Offline (4:30)
**Заголовок:** Работает без сети

```
Online:   RSS → PostgreSQL → Redis → React
                                        ↓
                                   IndexedDB (Dexie)

Offline:  IndexedDB → React (читаем кэш)

Reconnect: Sync delta → обновляем IndexedDB
```

**Визуал:** Два состояния с иконкой WiFi/No-WiFi

---

## Слайд 5 — Финальная архитектура кластера (6:00)
**Заголовок:** От одного процесса к кластеру

```
[VIP] → Nginx LB (×2, keepalived)
              ↓
    App-1 | App-2 | App-3  (Node.js + PM2)
              ↓
    PG Master + PG Slave×2  (Patroni)
              ↓
    Redis  (locks + cache + pub/sub)
```

**Визуал:** Диаграмма 8 из `11-scaling/diagrams-list.md`

---

## Слайд 6 — Честная оценка (8:30)

**Две колонки:**

| ✅ Что хорошо | ⚠️ Что улучшить |
|---|---|
| DDD с чёткими слоями | `KEYS` → нужен `SCAN` |
| Fallback на каждом уровне | Нет read/write splitting |
| TypeScript везде | Нет Grafana из коробки |
| 17 правил алертов | Нет distributed tracing |
| Distributed locks | Мало интеграционных тестов |

---

## Слайд 7 — 5 ключевых решений (9:30)
**Заголовок:** Решения, которые определили проект

1. **EventBus** — слабая связь между слоями (ADR-0001)
2. **Drizzle ORM** — SQL-first, типы из схемы (ADR-0002)
3. **Redis NX Lock** — distributed coordination без Zookeeper
4. **Двухуровневый кэш** — Redis → in-memory fallback (ADR-0004)
5. **Wouter** — 2 KB роутер вместо 50 KB (ADR-0008)

**Визуал:** Нумерованный список с иконками и ссылками на ADR

---

## Слайд 8 — Roadmap (12:00)
**Заголовок:** Куда двигаться дальше

**Ближайшее (1-3 месяца):**
- `SCAN` вместо `KEYS` в Redis
- OpenAPI / Swagger документация
- Grafana дашборд для Prometheus

**Среднесрочно (3-6 месяцев):**
- Read/write splitting для PostgreSQL
- OpenTelemetry distributed tracing
- Интеграционные тесты кластера

**Долгосрочно:**
- Kubernetes + Helm + HPA
- spaCy для английского NER
- Персонализация (локально, без профилирования)

**Визуал:** Горизонтальный timeline с тремя зонами

---

## Слайд 9 — Стек целиком (14:00)
**Заголовок:** Технологии, которые мы изучили

```
Frontend          Backend           AI
React 18          Node.js 20        FastAPI
TypeScript        Express           Natasha NER
Vite              PostgreSQL 17     pymorphy2
Zustand           Drizzle ORM
react-virtual     Redis 7
Dexie.js          express-ws
vite-plugin-pwa   web-push

DevOps            Security          Monitoring
Docker            Fail2Ban          AlertManager
Nginx             Custom CAPTCHA    Prometheus
PM2               SSL (Let's Encrypt) Winston
Patroni           DDoS protection   HealthCheckManager
keepalived        Redis NX locks    SlaMonitor
```

**Визуал:** Сетка технологий с логотипами

---

## Слайд 10 — Финальный (16:00)
**Заголовок:** Спасибо, что были с нами

```
🔗 GitHub: github.com/Chucha-blog/blogpro
📧 Email:  rockbandbugs@gmail.com

Весь код открыт. Форкайте. Улучшайте.
Пишите в комментариях — какой эпизод
понравился больше всего?
```

**Визуал:** QR-код на репозиторий, кнопка подписки, лайк
