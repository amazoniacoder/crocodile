# GitHub Commit History: Crocodile — Мастер-план

> **Цель:** Ретроспективная история коммитов, описывающая уже реализованный проект  
> **Аналог:** YouTube-серия из 12 эпизодов — здесь 12 смысловых групп коммитов  
> **Принцип:** Каждая группа = логически завершённый этап разработки

---

## 🎯 Концепция

Проект разрабатывался локально без регулярных коммитов. Цель — создать
**осмысленную публичную историю**, которая:

- Показывает эволюцию проекта от MVP до production
- Даёт контекст каждому решению через сообщения коммитов
- Соответствует реальной хронологии (CHANGELOG v1.0.0 → v2.0.0 → v2.1.0)
- Служит документацией для новых контрибьюторов

### Отличие от YouTube

| YouTube | GitHub |
|---------|--------|
| Эпизод = видео (15-30 мин) | Группа = серия коммитов |
| Сценарий + слайды | Commit message + тело коммита |
| Демонстрация кода | Реальные изменения файлов |
| Зритель смотрит | Разработчик читает `git log` |
| Один раз | Навсегда в истории |

---

## 📋 Структура плана

```
D:\BlogPro\docs\github\
├── 00-master-plan.md              # Этот файл
├── 01-project-init/               # Группа 1: Инициализация
│   └── commits.md
├── 02-core-rss/                   # Группа 2: RSS сбор
│   └── commits.md
├── 03-database-schema/            # Группа 3: Схема БД
│   └── commits.md
├── 04-frontend-foundation/        # Группа 4: Frontend основа
│   └── commits.md
├── 05-clustering-ai/              # Группа 5: Кластеризация + NER
│   └── commits.md
├── 06-realtime-websocket/         # Группа 6: WebSocket + уведомления
│   └── commits.md
├── 07-security/                   # Группа 7: Безопасность
│   └── commits.md
├── 08-monitoring/                 # Группа 8: Мониторинг
│   └── commits.md
├── 09-pwa-offline/                # Группа 9: PWA + офлайн
│   └── commits.md
├── 10-features-v2/                # Группа 10: Фичи v2.0
│   └── commits.md
├── 11-scaling-cluster/            # Группа 11: Масштабирование
│   └── commits.md
└── 12-hardening-v21/              # Группа 12: Hardening v2.1
    └── commits.md
```

---

## 🗂️ Группы коммитов (обзор)

### Группа 1 — Project Init
**Тег:** `v0.1.0`  
**Суть:** Скелет проекта — монорепо, TypeScript, Drizzle, базовые таблицы  
**Коммитов:** ~5

### Группа 2 — Core RSS Collection
**Тег:** `v0.2.0`  
**Суть:** RSS-парсер, белый список источников, дедупликация, расписание fast/slow  
**Коммитов:** ~6

### Группа 3 — Database Schema
**Тег:** `v0.3.0`  
**Суть:** Все миграции 0001–0013, GIN-индекс, триггер tsvector, архивирование  
**Коммитов:** ~8

### Группа 4 — Frontend Foundation
**Тег:** `v0.4.0`  
**Суть:** React 18 + Wouter + Zustand, виртуализированная лента, фильтры + URL sync  
**Коммитов:** ~7

### Группа 5 — Clustering & NER
**Тег:** `v0.5.0`  
**Суть:** Токенная кластеризация, NER-сервис (FastAPI + Natasha), Entity-Driven Cluster  
**Коммитов:** ~6

### Группа 6 — Realtime & Notifications
**Тег:** `v0.6.0`  
**Суть:** WebSocket, тост «N новых статей», EventBus, реакции и эмодзи  
**Коммитов:** ~5

### Группа 7 — Security
**Тег:** `v0.7.0`  
**Суть:** Собственная CAPTCHA, DDoS-защита, Fail2Ban, SSL-мониторинг, аудит  
**Коммитов:** ~7

### Группа 8 — Monitoring & Alerting
**Тег:** `v0.8.0`  
**Суть:** AlertManager, HealthMonitoringService, SlaMonitor, PrometheusMetrics, кабинет  
**Коммитов:** ~6

### Группа 9 — PWA & Offline
**Тег:** `v0.9.0`  
**Суть:** Service Worker (Workbox), IndexedDB (Dexie.js), Web Push (VAPID), PWA Badge  
**Коммитов:** ~6

### Группа 10 — Features v2.0
**Тег:** `v2.0.0`  
**Суть:** Погода, YouTube, Telegram, API-ключи, RSS-экспорт, донаты, аналитика, личные кабинеты  
**Коммитов:** ~12

### Группа 11 — Horizontal Scaling
**Тег:** `v2.0.1`  
**Суть:** DistributedScheduler, LoadBalancer, HealthCheckManager, FailoverController, WebSocketManager  
**Коммитов:** ~5

### Группа 12 — Hardening v2.1
**Тег:** `v2.1.0`  
**Суть:** Унификация алертов, миграция adminAuth, rate limiter конфиг, тесты (~100), документация  
**Коммитов:** ~8

---

## 📐 Формат коммита

### Структура сообщения

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Типы (Conventional Commits)

| Тип | Когда |
|-----|-------|
| `feat` | Новая функциональность |
| `fix` | Исправление бага |
| `refactor` | Рефакторинг без изменения поведения |
| `perf` | Оптимизация производительности |
| `test` | Добавление/изменение тестов |
| `docs` | Только документация |
| `chore` | Конфиги, зависимости, CI |
| `security` | Изменения безопасности |

### Скоупы проекта

| Скоуп | Что покрывает |
|-------|--------------|
| `rss` | RSS-парсер, источники, расписание |
| `db` | Миграции, схема, индексы |
| `api` | Express роуты, middleware |
| `frontend` | React компоненты, стор |
| `cluster` | Кластеризация новостей |
| `ner` | NER-сервис, Python |
| `ws` | WebSocket, real-time |
| `security` | CAPTCHA, DDoS, Fail2Ban |
| `monitoring` | AlertManager, метрики |
| `pwa` | Service Worker, IndexedDB |
| `push` | Web Push, VAPID |
| `weather` | Модуль погоды |
| `youtube` | YouTube интеграция |
| `telegram` | Telegram интеграция |
| `auth` | Токены, API-ключи |
| `infra` | Docker, Nginx, CI |

### Пример хорошего коммита

```
feat(rss): add dual-schedule collection with fast/slow sources

Implement two independent cron schedules:
- fast: every 1 min for breaking news sources (Lenta, RBC, TASS)
- slow: every 5 min for analytical sources (Habr, Guardian)

Deduplication by URL via PostgreSQL UNIQUE constraint.
sanitize-html applied to all descriptions before storage.

Closes #12
```

### Пример плохого коммита (избегать)

```
fix stuff          ← нет контекста
update files       ← непонятно что
WIP                ← не должно быть в публичной истории
```

---

## 🏷️ Теги и версии

```
v0.1.0  — Project skeleton
v0.2.0  — RSS collection working
v0.3.0  — Full DB schema
v0.4.0  — Frontend MVP
v0.5.0  — Clustering + NER
v0.6.0  — Realtime features
v0.7.0  — Security layer
v0.8.0  — Monitoring
v0.9.0  — PWA + offline
v2.0.0  — Feature-complete release (CHANGELOG v2.0.0)
v2.0.1  — Horizontal scaling
v2.1.0  — Hardening + tests (CHANGELOG v2.1.0)
```

> Прыжок с v0.9.0 на v2.0.0 намеренный — соответствует публичному CHANGELOG.

---

## 🔗 Связь с YouTube-серией

| YouTube эпизод | GitHub группа |
|----------------|---------------|
| Эп. 1 — Обзор | Все группы (финальный результат) |
| Эп. 2 — Архитектура | Группа 1 (init + DDD структура) |
| Эп. 3 — Backend RSS | Группа 2 |
| Эп. 4 — Frontend | Группа 4 |
| Эп. 5 — AI/NER | Группа 5 |
| Эп. 6 — PWA | Группа 9 |
| Эп. 7 — Безопасность | Группа 7 |
| Эп. 8 — Мониторинг | Группа 8 |
| Эп. 9 — БД | Группа 3 |
| Эп. 10 — Deployment | Группа 1 (infra) + Группа 12 |
| Эп. 11 — Масштабирование | Группа 11 |
| Эп. 12 — Итоги | Группа 12 |

---

## 🚀 Порядок выполнения

### Шаг 1 — Подготовка репозитория
```bash
# Убедиться что .gitignore корректен
# Удалить временные файлы (tmp_*.json, *.xml в корне)
# Проверить .env.example — нет реальных секретов
```

### Шаг 2 — Создать коммиты по группам
Каждый файл `commits.md` содержит точные сообщения и список файлов.  
Коммиты создаются через `git add <files> && git commit -m "..."`.

### Шаг 3 — Расставить теги
```bash
git tag -a v0.1.0 <hash> -m "Project skeleton"
git tag -a v2.1.0 HEAD -m "Hardening: unified alerts, 100 tests"
```

### Шаг 4 — Push
```bash
git push origin main --tags
```

---

## ⚠️ Важные правила

- **Не коммитить** `tmp_*.json`, `*.xml` тест-файлы из корня, `client — копия*/`
- **Не коммитить** реальные значения из `.env` — только `.env.example`
- **Не коммитить** `server/db/backup/*.sql` — содержат реальные данные
- **Не коммитить** `ssl/cert.pem`, `ssl/key.pem`
- Файл `.gitignore` проверить **до первого коммита**

---

*История коммитов — это документация проекта во времени. Хорошие сообщения коммитов стоят дороже комментариев в коде.*
