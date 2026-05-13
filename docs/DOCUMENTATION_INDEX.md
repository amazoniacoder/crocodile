# Навигация по документации

> **Версия:** 2.1.0  
> **Создан:** Май 2025  
> **Последнее обновление:** Май 2025

---

## Быстрый старт

| Документ | Описание | Время чтения |
|----------|----------|--------------|
| [README.md](../README.md) | Обзор проекта, установка, ключевые возможности | 10 мин |
| [МАНИФЕСТ.md](./МАНИФЕСТ.md) | Принципы и философия проекта | 5 мин |
| [ONBOARDING.md](./ONBOARDING.md) | Пошаговый гайд для новых разработчиков | 1 час |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Как внести вклад в проект | 15 мин |

---

## Рекомендуемые пути обучения

### Backend-разработчик
1. [ONBOARDING.md](./ONBOARDING.md) — общее знакомство (1 час)
2. [ARCHITECTURE.md](./ARCHITECTURE.md) — архитектура системы (20 мин)
3. [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) — структура БД (30 мин)
4. [guide/DEVELOPER_GUIDE.md](./guide/DEVELOPER_GUIDE.md) — частые задачи (25 мин)
5. [TESTING.md](./TESTING.md) — тестирование (30 мин)

**Итого:** ~2.5 часа

### Frontend-разработчик
1. [ONBOARDING.md](./ONBOARDING.md) — общее знакомство (1 час)
2. [ARCHITECTURE.md](./ARCHITECTURE.md) — архитектура системы (20 мин)
3. [diagrams/DATA_FLOW.md](./diagrams/DATA_FLOW.md) — потоки данных (30 мин)
4. [guide/DEVELOPER_GUIDE.md](./guide/DEVELOPER_GUIDE.md) — API эндпоинты (15 мин)
5. [TESTING.md](./TESTING.md) — тестирование UI (20 мин)

**Итого:** ~2 часа

### DevOps-инженер
1. [ONBOARDING.md](./ONBOARDING.md) — общее знакомство (1 час)
2. [guide/DEPLOY_GUIDE.md](./guide/DEPLOY_GUIDE.md) или [guide/DEPLOY_GUIDE_4GB.md](./guide/DEPLOY_GUIDE_4GB.md) — деплой (30 мин)
3. [guide/PERFORMANCE.md](./guide/PERFORMANCE.md) — оптимизация (25 мин)
4. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — типичные проблемы (20 мин)
5. [guide/MONITOR_GUIDE.md](./guide/MONITOR_GUIDE.md) — мониторинг (20 мин)

**Итого:** ~2 часа

### QA-инженер
1. [ONBOARDING.md](./ONBOARDING.md) — общее знакомство (1 час)
2. [TESTING.md](./TESTING.md) — структура тестов (30 мин)
3. [guide/DEVELOPER_GUIDE.md](./guide/DEVELOPER_GUIDE.md) — API для тестирования (15 мин)
4. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — типичные проблемы (20 мин)

**Итого:** ~1.5 часа

---

## Архитектура

| Документ | Описание | Время чтения |
|----------|----------|--------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Обзор системы, слои, компоненты, ссылки на все документы | 20 мин |
| [diagrams/DATA_FLOW.md](./diagrams/DATA_FLOW.md) | 7 mermaid-диаграмм потоков данных | 30 мин |
| [diagrams/C4_ARCHITECTURE.md](./diagrams/C4_ARCHITECTURE.md) | C4-модель: Context, Container, Component, Deployment | 25 мин |
| [diagrams/DATABASE_SCHEMA.md](./diagrams/DATABASE_SCHEMA.md) | ER-диаграмма, индексы, триггеры, жизненный цикл данных | 20 мин |
| [diagrams/MODULE_DEPENDENCIES.md](./diagrams/MODULE_DEPENDENCIES.md) | Граф зависимостей, DDD layers, правила импорта | 15 мин |
| [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) | Подробное описание 16 таблиц, связи, миграции | 30 мин |

---

## Специализированные гайды

### Основные функции

| Документ | Описание | Время чтения |
|----------|----------|--------------|
| [guide/YOUTUBE_GUIDE.md](./guide/YOUTUBE_GUIDE.md) | YouTube-каналы: добавление, архитектура, API | 30 мин |
| [guide/TELEGRAM_GUIDE.md](./guide/TELEGRAM_GUIDE.md) | Telegram-каналы: интеграция через RSSHub | 20 мин |
| [guide/PERSONAL_FEED_GUIDE.md](./guide/PERSONAL_FEED_GUIDE.md) | Личные кабинеты: токены, подписки, управление | 40 мин |
| [guide/NER_SERVICE_GUIDE.md](./guide/NER_SERVICE_GUIDE.md) | Entity-Driven Cluster, запуск NER-сервиса, настройка | 25 мин |
| [guide/CLUSTERING_GUIDE.md](./guide/CLUSTERING_GUIDE.md) | Токенная кластеризация, алгоритм, примеры, метрики | 30 мин |
| [guide/WEATHER_SYSTEM_GUIDE.md](./guide/WEATHER_SYSTEM_GUIDE.md) | Модуль погоды: API, архитектура, компоненты, БД | 35 мин |
| [guide/RSSHUB_GUIDE.md](./guide/RSSHUB_GUIDE.md) | Настройка и использование локального RSSHub | 15 мин |

### Административные функции

| Документ | Описание | Время чтения |
|----------|----------|--------------|
| [guide/MONITOR_GUIDE.md](./guide/MONITOR_GUIDE.md) | Кабинет мониторинга, все зоны, метрики | 20 мин |
| [guide/DONATE_GUIDE.md](./guide/DONATE_GUIDE.md) | Система донатов, управление реквизитами, ЮMoney | 10 мин |
| [guide/ANALYTICS_GUIDE.md](./guide/ANALYTICS_GUIDE.md) | Анонимная аналитика, архитектура, API, кабинет | 15 мин |
| [guide/CLUSTER_TESTING_GUIDE.md](./guide/CLUSTER_TESTING_GUIDE.md) | Тестирование кластеризации | 15 мин |

### Безопасность и инфраструктура

| Документ | Описание | Время чтения |
|----------|----------|--------------|
| [guide/SECURITY_GUIDE.md](./guide/SECURITY_GUIDE.md) | CAPTCHA, DDoS, Fail2Ban, SSL, AlertManager, Cloudflare | 30 мин |
| [guide/BACKUP_GUIDE.md](./guide/BACKUP_GUIDE.md) | GFS ротация бэкапов, верификация, восстановление | 20 мин |

---

## Операционные руководства

| Документ | Описание | Время чтения |
|----------|----------|--------------|
| [guide/DEPLOY_GUIDE.md](./guide/DEPLOY_GUIDE.md) | Деплой на Ubuntu 24.04 · 1 CPU / 2 GB RAM / 30 GB | 30 мин |
| [guide/DEPLOY_GUIDE_4GB.md](./guide/DEPLOY_GUIDE_4GB.md) | Деплой на Ubuntu 24.04 · 2 CPU / 4 GB RAM / 60 GB NVMe | 30 мин |
| [guide/DEVELOPER_GUIDE.md](./guide/DEVELOPER_GUIDE.md) | Частые задачи, curl-команды, навигация по коду, API | 25 мин |
| [TESTING.md](./TESTING.md) | Структура тестов, примеры, шаблоны, CI/CD, покрытие | 30 мин |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | 9 типичных проблем с решениями | 20 мин |
| [guide/PERFORMANCE.md](./guide/PERFORMANCE.md) | Оптимизация БД, кэширование, rate limiting, метрики | 25 мин |
| [guide/API_KEYS_GUIDE.md](./guide/API_KEYS_GUIDE.md) | Управление API-ключами, rate limiting, интеграция | 20 мин |
| [AUTHENTICATION.md](./AUTHENTICATION.md) | TokenManager, authenticateAdmin, миграция с legacy | 20 мин |

---

## Архитектурные решения (ADR)

| Документ | Описание | Дата |
|----------|----------|------|
| [adr/README.md](./adr/README.md) | Список всех ADR | — |
| [adr/0001-event-bus-architecture.md](./adr/0001-event-bus-architecture.md) | Почему EventBus вместо прямых вызовов | 2025-05 |
| [adr/0002-drizzle-orm.md](./adr/0002-drizzle-orm.md) | Почему Drizzle, а не Prisma/TypeORM | 2025-05 |
| [adr/0003-pymorphy2-normalization.md](./adr/0003-pymorphy2-normalization.md) | Почему pymorphy2 для русского | 2025-05 |
| [adr/0004-redis-cache-strategy.md](./adr/0004-redis-cache-strategy.md) | Двухуровневый кэш, теги | 2025-05 |
| [adr/0005-indexeddb-offline.md](./adr/0005-indexeddb-offline.md) | Почему Dexie, TTL, GC | 2025-05 |
| [adr/0006-web-push-vapid.md](./adr/0006-web-push-vapid.md) | Почему VAPID, а не FCM | 2025-05 |
| [adr/0007-api-keys-sha256.md](./adr/0007-api-keys-sha256.md) | Хэширование ключей, префикс na_ | 2025-05 |
| [adr/0008-wouter-routing.md](./adr/0008-wouter-routing.md) | Почему Wouter, а не React Router | 2025-05 |
| [adr/0009-zustand-state.md](./adr/0009-zustand-state.md) | Почему Zustand, а не Redux/Context | 2025-05 |

---

## Частые задачи

| Задача | Команда / Ссылка |
|--------|------------------|
| Добавить RSS-источник | `curl -X POST http://localhost:5000/api/admin/sources -H "Authorization: Bearer $TOKEN" -d '{...}'` → [guide/DEVELOPER_GUIDE.md](./guide/DEVELOPER_GUIDE.md) |
| Создать миграцию БД | `npx drizzle-kit generate` → [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) |
| Запустить тесты | `npm test` → [TESTING.md](./TESTING.md) |
| Сгенерировать API-ключ | `curl -X POST http://localhost:5000/api/admin/api-keys -H "Authorization: Bearer $TOKEN"` → [guide/API_KEYS_GUIDE.md](./guide/API_KEYS_GUIDE.md) |
| Очистить кэш | `curl -X POST http://localhost:5000/api/admin/cache/clear -H "Authorization: Bearer $TOKEN"` → [guide/PERFORMANCE.md](./guide/PERFORMANCE.md) |
| Запустить кластеризацию | `curl -X POST http://localhost:5000/api/admin/clustering/run -H "Authorization: Bearer $TOKEN"` → [guide/CLUSTERING_GUIDE.md](./guide/CLUSTERING_GUIDE.md) |
| Проверить здоровье системы | `curl http://localhost:5000/api/health` → [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |

---

## Поиск по документации

### По ключевым словам

**RSS сбор:**
- [ARCHITECTURE.md](./ARCHITECTURE.md) — раздел "RSS Сбор"
- [diagrams/DATA_FLOW.md](./diagrams/DATA_FLOW.md) — диаграмма "RSS сбор"
- [guide/DEVELOPER_GUIDE.md](./guide/DEVELOPER_GUIDE.md) — раздел "Добавить источник"

**Кластеризация:**
- [guide/CLUSTERING_GUIDE.md](./guide/CLUSTERING_GUIDE.md)
- [guide/NER_SERVICE_GUIDE.md](./guide/NER_SERVICE_GUIDE.md)
- [diagrams/DATA_FLOW.md](./diagrams/DATA_FLOW.md#2-eventbus--кластеризация)

**Кэширование:**
- [guide/PERFORMANCE.md](./guide/PERFORMANCE.md) — раздел "Кэширование"
- [ARCHITECTURE.md](./ARCHITECTURE.md) — раздел "Кэширование"
- [adr/0004-redis-cache-strategy.md](./adr/0004-redis-cache-strategy.md)

**Офлайн-режим:**
- [diagrams/DATA_FLOW.md](./diagrams/DATA_FLOW.md) — диаграмма "Офлайн-режим"
- [adr/0005-indexeddb-offline.md](./adr/0005-indexeddb-offline.md)

**Web Push:**
- [diagrams/DATA_FLOW.md](./diagrams/DATA_FLOW.md) — диаграмма "Web Push"
- [adr/0006-web-push-vapid.md](./adr/0006-web-push-vapid.md)

**WebSocket:**
- [ARCHITECTURE.md](./ARCHITECTURE.md) — раздел "WebSocket"
- [diagrams/DATA_FLOW.md](./diagrams/DATA_FLOW.md) — диаграмма "WebSocket"
- [guide/DEVELOPER_GUIDE.md](./guide/DEVELOPER_GUIDE.md) — раздел "WebSocket"

**EventBus:**
- [ARCHITECTURE.md](./ARCHITECTURE.md) — раздел "EventBus"
- [adr/0001-event-bus-architecture.md](./adr/0001-event-bus-architecture.md)
- [diagrams/DATA_FLOW.md](./diagrams/DATA_FLOW.md) — диаграмма "EventBus"

**Погода:**
- [guide/WEATHER_SYSTEM_GUIDE.md](./guide/WEATHER_SYSTEM_GUIDE.md)
- [diagrams/DATA_FLOW.md](./diagrams/DATA_FLOW.md) — диаграмма "Погода"
- [guide/DEVELOPER_GUIDE.md](./guide/DEVELOPER_GUIDE.md) — раздел "Погода"

**API-ключи:**
- [guide/API_KEYS_GUIDE.md](./guide/API_KEYS_GUIDE.md)
- [guide/DEVELOPER_GUIDE.md](./guide/DEVELOPER_GUIDE.md) — раздел "API-ключи"
- [adr/0007-api-keys-sha256.md](./adr/0007-api-keys-sha256.md)

**Аутентификация:**
- [AUTHENTICATION.md](./AUTHENTICATION.md)
- [guide/DEVELOPER_GUIDE.md](./guide/DEVELOPER_GUIDE.md) — раздел "Аутентификация"

**Безопасность:**
- [guide/SECURITY_GUIDE.md](./guide/SECURITY_GUIDE.md)
- [AUTHENTICATION.md](./AUTHENTICATION.md)
- [guide/BACKUP_GUIDE.md](./guide/BACKUP_GUIDE.md)

**Личные кабинеты:**
- [guide/PERSONAL_FEED_GUIDE.md](./guide/PERSONAL_FEED_GUIDE.md)
- [guide/DEVELOPER_GUIDE.md](./guide/DEVELOPER_GUIDE.md) — раздел "Токены"

**Drizzle ORM:**
- [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md)
- [adr/0002-drizzle-orm.md](./adr/0002-drizzle-orm.md)
- [guide/DEVELOPER_GUIDE.md](./guide/DEVELOPER_GUIDE.md) — раздел "База данных"

**Zustand:**
- [ARCHITECTURE.md](./ARCHITECTURE.md) — раздел "Состояние клиента"
- [adr/0009-zustand-state.md](./adr/0009-zustand-state.md)

**Wouter:**
- [ARCHITECTURE.md](./ARCHITECTURE.md) — раздел "Роутинг"
- [adr/0008-wouter-routing.md](./adr/0008-wouter-routing.md)

**Тесты:**
- [TESTING.md](./TESTING.md)
- [guide/DEVELOPER_GUIDE.md](./guide/DEVELOPER_GUIDE.md) — раздел "Тесты"

**Производительность:**
- [guide/PERFORMANCE.md](./guide/PERFORMANCE.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — раздел "Медленная лента"

---

## Обновление документации

### Когда обновлять

**Обязательно:**
- Новые API эндпоинты → [guide/DEVELOPER_GUIDE.md](./guide/DEVELOPER_GUIDE.md)
- Изменение БД → [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md), [diagrams/DATABASE_SCHEMA.md](./diagrams/DATABASE_SCHEMA.md)
- Новая функциональность → [README.md](../README.md), [ARCHITECTURE.md](./ARCHITECTURE.md)
- Новая зависимость → [diagrams/MODULE_DEPENDENCIES.md](./diagrams/MODULE_DEPENDENCIES.md)

**Желательно:**
- Рефакторинг → [ARCHITECTURE.md](./ARCHITECTURE.md)
- Оптимизация → [guide/PERFORMANCE.md](./guide/PERFORMANCE.md)
- Исправление бага → [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### Как обновлять

1. Внести изменения в соответствующий документ
2. Обновить [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) (этот файл)
3. Проверить ссылки между документами
4. Создать PR с меткой `docs`

---

## Контакты

- **GitHub:** https://github.com/Chucha-blog/blogpro
- **Issues:** https://github.com/Chucha-blog/blogpro/issues
- **Email:** rockbandbugs@gmail.com

---

## Changelog индекса

| Версия | Дата | Изменения |
|--------|------|----------|
| 2.1.0 | Май 2025 | Удалён раздел «Планы развития», добавлены SECURITY_GUIDE и BACKUP_GUIDE, добавлен МАНИФЕСТ.md, исправлено описание MONITOR_GUIDE, добавлен раздел «Безопасность» в поиск |
| 2.0.0 | Май 2025 | Добавлены рекомендуемые пути обучения для ролей, версионирование ключевых документов, CI для проверки ссылок, упрощён поиск по ключевым словам |
| 1.3 | Май 2025 | Добавлены отсутствующие документы (планы, баги, CLUSTER_TESTING_GUIDE), раздел «История изменений» расширен |
| 1.2 | Май 2025 | Исправлены пути к файлам в `guide/`, убраны несуществующие документы, исправлены якоря, «зоны A-K» → «зоны A-C», добавлен RSSHUB_GUIDE |
| 1.1 | Май 2025 | Добавлен раздел "Частые задачи", расширен поиск (WebSocket, EventBus, Drizzle, Zustand, Wouter), удалено дублирование "Навигация по темам" |
| 1.0 | Май 2025 | Первая версия индекса |

---

*Последнее обновление: Май 2025*
