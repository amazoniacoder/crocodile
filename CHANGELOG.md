# Changelog

Все значимые изменения в проекте Crocodile (NewsAggregator) документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
и проект придерживается [Semantic Versioning](https://semver.org/lang/ru/).

---

## [2.1.0] - 2025-05-XX

### Добавлено

#### Система алертов
- Унифицирована система алертов — все правила консолидированы в `AlertManager`
- Добавлены 3 новых правила алертов:
  - `database-critical` — критическое состояние БД
  - `redis-unavailable` — недоступность Redis
  - `rate-limiter-high-utilization` — высокая утилизация кэша лимитеров (>80%)
- Интеграция AlertManager с `HealthMonitoringService` через `SystemMetrics`

#### Rate Limiting
- Конфигурируемый лимит rate limiters через переменную окружения `MAX_RATE_LIMITERS` (default: 1000)
- Новый эндпоинт `GET /api/admin/monitoring/rate-limiters` для метрик кэша лимитеров
- Логирование LRU-очистки на уровне debug
- Метрики: `activeLimiters`, `maxLimiters`, `utilizationPercent`, `lruEvictions`

#### Тестирование
- Добавлено ~75 новых тестов (E2E + Unit + Integration):
  - `server/__tests__/e2e/full-cycle.test.ts` — полный цикл сбора → кластеризация → уведомления → кэш (4 теста)
  - `server/__tests__/auth/TokenManager.test.ts` — управление токенами администраторов (15+ тестов)
  - `server/__tests__/auth/ApiKeyService.test.ts` — управление API-ключами (20+ тестов)
  - `server/__tests__/monitoring/AlertManager.test.ts` — система алертов (15+ тестов)
  - `server/__tests__/monitoring/HealthMonitoring.test.ts` — проверка здоровья компонентов (20+ тестов)
- Общее покрытие тестами: ~100 тестов

#### Документация
- Создан [TECHNICAL_DEBT_PLAN.md](./docs/TECHNICAL_DEBT_PLAN.md) — план устранения технического долга
- Создан [TECHNICAL_DEBT_PROGRESS.md](./docs/TECHNICAL_DEBT_PROGRESS.md) — статус выполнения задач
- Консолидирована документация модуля погоды:
  - Архивирован `WEATHER_IMPROVEMENT_PLAN.md` → `docs/archive/WEATHER_IMPROVEMENT_PLAN_v1.md`
  - Удалён `WEATHER_MODULE_GUIDE.md` (дублировал SYSTEM_GUIDE)
  - Оставлен единственный актуальный документ: `WEATHER_SYSTEM_GUIDE.md`

### Изменено

#### Аутентификация
- Все admin-роуты мигрированы с `adminAuth` на `authenticateAdmin`:
  - `server/api/admin/analytics.ts`
  - `server/api/admin/cluster/index.ts`
  - `server/api/admin/cluster/tests.ts`
  - `server/api/admin/config.ts`
  - `server/api/admin/ner.ts`
- Удалены дублирующие вызовы middleware в отдельных роутах кластера

#### Мониторинг
- `AlertingService` помечен как `@deprecated` — будет удалён в v3.0.0
- Вся функциональность перенесена в `AlertManager`
- Добавлен файл `AlertingService.deprecated.ts` с инструкциями миграции

#### Документация
- Обновлён `DEVELOPER_GUIDE.md`:
  - Версия 1.9.0 → 2.1.0
  - Добавлен раздел "Метрики rate limiting"
  - Обновлён список тестов (~100 тестов)
  - Добавлен `MAX_RATE_LIMITERS` в пример `.env`
  - Упоминание deprecation `adminAuth`
- Обновлён `README.md`:
  - Версия 2.0.0 → 2.1.0
  - Добавлены ссылки на документацию технического долга
  - Обновлён статус проекта

### Устранено

#### Технический долг
- Унифицирована система алертов (было 2 параллельные системы)
- Мигрирован устаревший middleware `adminAuth` → `authenticateAdmin` (5 файлов)
- Устранён хардкод `MAX_LIMITERS` — теперь конфигурируется через `.env`
- Консолидирована документация погоды (было 3 документа → стал 1)

#### Безопасность
- Все admin-роуты теперь используют единый middleware `authenticateAdmin` с поддержкой:
  - Токенов из таблицы `admin_tokens` (bcrypt)
  - Fallback на legacy `ADMIN_TOKEN` из `.env`
  - Аудит через `AuditLogger`

### Deprecated

- `adminAuth` middleware (`server/middleware/adminAuth.ts`) — будет удалён в следующем мажорном релизе
- `AlertingService` (`server/infrastructure/monitoring/AlertingService.ts`) — будет удалён в v3.0.0

---

## [2.0.0] - 2025-04-XX

### Добавлено
- Модуль погоды с прогнозом на 7 дней для 51 города России
- Виджет погоды на главной странице с автоопределением города
- PWA с офлайн-режимом (IndexedDB, 14 дней хранения)
- Web Push уведомления (VAPID, Service Worker)
- API-ключи для публичного API с настраиваемым rate limiting
- RSS-экспорт отфильтрованной ленты
- Система донатов с виджетом ЮMoney и QR-кодами
- Анонимная аналитика посещений и кликов
- Горизонтальное масштабирование с автоматическим failover
- Комплексная система мониторинга и алертинга
- Enterprise-уровень безопасности (DDoS защита, аудит, ротация токенов)

### Изменено
- Морфологическая кластеризация новостей через pymorphy2
- Полнотекстовый поиск с GIN-индексом и триггером `tsvector_update`
- Фильтрация по нескольким категориям одновременно
- Двухуровневый кэш: Redis → in-memory fallback

---

## [1.0.0] - 2025-01-XX

### Добавлено
- Базовый функционал новостного агрегатора
- Сбор RSS из проверенных источников
- Кластеризация похожих новостей
- Фильтрация по региону, категории, дате
- WebSocket-уведомления о новых статьях
- Виртуализированная лента с бесконечной прокруткой
- Реакции на статьи (лайки, дизлайки, эмодзи)
- Тёмная тема и адаптивный дизайн

---

[2.1.0]: https://github.com/Chucha-blog/blogpro/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/Chucha-blog/blogpro/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Chucha-blog/blogpro/releases/tag/v1.0.0
