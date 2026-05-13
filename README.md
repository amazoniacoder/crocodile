# Crocodile

**🌐 [crocodile.press](https://crocodile.press)** — независимый новостной агрегатор без алгоритмов подтасовки. Собирает новости из проверенных RSS-источников, группирует похожие материалы из разных СМИ и отдаёт их в реальном времени.

## О проекте

Белый список источников — только проверенные СМИ. Регион и категория каждой статьи наследуются от источника, без анализа заголовков и алгоритмического ранжирования. Пользователь всегда видит, откуда пришла новость.

**Текущие источники:** Lenta.ru (8 тематических лент), RBC, Habr, The Guardian (8 лент), Al Jazeera, ТАСС и Reuters через RSSHub.

## Ключевые возможности

- **YouTube-каналы** — страница `/youtube`, iframe-плеер в карточке, официальные RSS-фиды, витринный канал бесплатно
- **Telegram-каналы** — страница `/social`, виджет поста через RSSHub, без VPN
- Сбор RSS по двум расписаниям (fast/slow) с автоматической дедупликацией по URL
- Кластеризация похожих новостей из разных источников (морфологическая нормализация через pymorphy2)
- Фильтрация по региону (Россия / Мир), **нескольким категориям одновременно**, городу, дате и источнику
- Полнотекстовый поиск на русском и английском (PostgreSQL GIN-индекс, триггер `tsvector_update`)
- WebSocket-уведомления о новых статьях → тост «N новых статей» с подтверждением пользователя
- Виртуализированная лента с бесконечной прокруткой (`@tanstack/react-virtual`)
- Синхронизация фильтров с URL — отфильтрованной лентой можно поделиться
- Двухуровневый кэш: Redis → in-memory fallback с тегированной инвалидацией
- Лайки, дизлайки и эмодзи-реакции на статьях
- Архивирование статей старше 14 дней, физическое удаление через 14 дней после архивирования
- Анонимная аналитика посещений и кликов (без cookie, без IP)
- Система донатов с виджетом ЮMoney и QR-кодами реквизитов
- **Комплексная система безопасности** — SSL мониторинг, DDoS защита, собственная CAPTCHA, Fail2Ban
- **Автоматические бэкапы** — ротация по схеме GFS с верификацией целостности
- **Централизованные алерты** — SSL, disk, backup, Fail2Ban через единую систему AlertManager
- **Enterprise-уровень безопасности** — 17 правил алертов, проактивный мониторинг
- **Горизонтальное масштабирование** — кластер с автоматическим failover
- Тёмная тема, адаптивный дизайн, BEM CSS
- **Личные кабинеты** — страница `/my`, доступ по токену, подписки на каналы
- **Web Push уведомления** — браузерные push при появлении новых статей (VAPID, Service Worker)
- **API-ключи** — публичный API с rate limiting: 120 req/мин без ключа, настраиваемый лимит с ключом
- **RSS-экспорт** — отфильтрованная лента в формате RSS для внешних ридеров
- **Страница источников** — публичный список активных источников с регионом и категорией
- Кнопка «Поделиться» на карточках (Web Share API + fallback на копирование)
- PWA Badge — счётчик непрочитанных на иконке приложения
- **Прогноз погоды** — страница `/weather`, таблица на 7 дней (температура, осадки, ветер, влажность, давление, фазы луны, геомагнетная активность), 51 город России
- **Виджет погоды** — выдвижная панель на главной, автоопределение города через `navigator.geolocation` (без хранения данных)

## Технологический стек

### Frontend
- **React 18.3.1** + **TypeScript 5.6.3**
- **Vite 6.3.5** — сборка и HMR
- **Wouter** — роутинг
- **Zustand** — состояние
- **@tanstack/react-virtual** — виртуализация ленты
- **Recharts** — графики в кабинете мониторинга
- **qrcode.react** — QR-коды для реквизитов доната
- **Dexie.js** — IndexedDB офлайн-архив
- **vite-plugin-pwa** — Service Worker (injectManifest), Workbox, манифест

### Backend
- **Node.js 20.x** + **Express.js 4.21.2**
- **PostgreSQL 17.x** + **Drizzle ORM** — база данных
- **Redis 7.x** — кэширование
- **WebSocket (express-ws)** — real-time уведомления
- **web-push** — Web Push уведомления (VAPID)
- **rss-parser** — парсинг RSS-лент
- **sanitize-html** — очистка HTML из описаний
- **node-cron** — планировщик задач
- **Winston** — логирование

### DevOps
- **Docker + Docker Compose** — контейнеризация
- **Nginx** — reverse proxy, SSL termination
- **PM2** — управление процессами
- **Drizzle Kit** — миграции БД
- **ESLint + Prettier** — качество кода
- **Vitest** — unit и e2e тесты сервера и клиента
- **supertest** — HTTP-тестирование Express роутеров

## Быстрый старт

### Требования

- Node.js 20+
- PostgreSQL 17+
- Redis 7+ (опционально — без него работает in-memory кэш)

### Установка

```bash
git clone git@github.com:amazoniacoder/crocodile.git
cd crocodile
npm install
```

### Настройка окружения

```bash
cp .env.example .env
```

Минимальная конфигурация `.env`:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgres://user:password@localhost:5432/news_aggregator
REDIS_URL=redis://localhost:6379
ADMIN_TOKEN=<сгенерировать: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

# Web Push (опционально)
# Генерация: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
PUSH_THRESHOLD=5
```

### Миграции БД

```bash
npx drizzle-kit migrate
```

### Запуск в режиме разработки

```bash
npm run dev
```

### Production сборка

```bash
npm run build
npm run start
```

### Docker

```bash
docker-compose up -d
```

## База данных

16 таблиц:

| Таблица | Назначение |
|---------|-----------|
| `news_sources` | Белый список RSS-источников |
| `news_articles` | Собранные статьи (UNIQUE по URL, GIN-индекс `search_vector`) |
| `news_clusters` | Группы похожих новостей |
| `collection_stats` | Статистика каждого цикла сбора |
| `source_config` | Настройки планировщика и доната |
| `page_events` | Анонимная аналитика посещений и кликов |
| `article_reactions` | Лайки и дизлайки |
| `article_emotions` | Эмодзи-реакции |
| `hot_entities` | Горячие NER-сущности за 24ч |
| `admin_audit_log` | Аудит административных действий |
| `admin_tokens` | Токены администраторов |
| `push_subscriptions` | Web Push подписки пользователей |
| `api_keys` | API-ключи для публичного API |
| `weather_locations` | Города для модуля погоды |
| `weather_forecasts` | Дневные прогнозы (7 дней × N городов) |
| `weather_hourly_forecasts` | Почасовые прогнозы (168 часов × N городов) |

## Документация

### Быстрый старт
- [Onboarding Guide](./docs/ONBOARDING.md) — пошаговый гайд для новых разработчиков (1 час)
- [Contributing Guide](./CONTRIBUTING.md) — как внести вклад в проект
- [Documentation Index](./docs/DOCUMENTATION_INDEX.md) — полная навигация по всей документации

### Архитектура
- [Architecture](./docs/ARCHITECTURE.md) — обзор системы, слои, компоненты (единая точка входа)
- [Data Flow Diagrams](./docs/diagrams/DATA_FLOW.md) — 7 mermaid-диаграмм потоков данных
- [C4 Architecture](./docs/diagrams/C4_ARCHITECTURE.md) — Context, Container, Component, Deployment
- [Database Schema](./docs/diagrams/DATABASE_SCHEMA.md) — ER-диаграмма, индексы, триггеры
- [Module Dependencies](./docs/diagrams/MODULE_DEPENDENCIES.md) — граф зависимостей, DDD layers
- [Database Architecture](./docs/DATABASE_ARCHITECTURE.md) — подробное описание 16 таблиц

### Специализированные гайды
- [YouTube Guide](./docs/guide/YOUTUBE_GUIDE.md) — добавление каналов, архитектура, API
- [Telegram Guide](./docs/guide/TELEGRAM_GUIDE.md) — интеграция Telegram-каналов
- [Developer Guide](./docs/guide/DEVELOPER_GUIDE.md) — частые задачи, curl-команды, навигация по коду
- [Testing Guide](./docs/TESTING.md) — структура тестов, примеры, шаблоны, CI/CD
- [Troubleshooting](./docs/TROUBLESHOOTING.md) — 9 типичных проблем с решениями
- [Performance Guide](./docs/guide/PERFORMANCE.md) — оптимизация БД, кэширование, метрики
- [Clustering Guide](./docs/guide/CLUSTERING_GUIDE.md) — токенная кластеризация, алгоритм
- [NER Service Guide](./docs/guide/NER_SERVICE_GUIDE.md) — Entity-Driven Cluster, запуск, настройка
- [Weather System Guide](./docs/guide/WEATHER_SYSTEM_GUIDE.md) — модуль погоды: API, архитектура, компоненты
- [API Keys Guide](./docs/guide/API_KEYS_GUIDE.md) — управление API-ключами, rate limiting
- [Authentication Guide](./docs/AUTHENTICATION.md) — TokenManager, authenticateAdmin
- [Monitor Guide](./docs/guide/MONITOR_GUIDE.md) — кабинет мониторинга, зоны A-C
- [Donate Guide](./docs/guide/DONATE_GUIDE.md) — система донатов, ЮMoney
- [Analytics Guide](./docs/guide/ANALYTICS_GUIDE.md) — анонимная аналитика

### История изменений
- [Improvement Plan v1](./docs/IMPROVEMENT_PLAN.md) — ✅ реализован полностью
- [Improvement Plan v2](./docs/IMPROVEMENT_PLAN_V2.md) — ✅ реализован полностью
- [Improvement Plan v3](./docs/IMPROVEMENT_PLAN_V3.md) — ✅ реализован полностью
- [Technical Debt Plan](./docs/TECHNICAL_DEBT_PLAN.md) — 🔄 в работе
- [Technical Debt Progress](./docs/TECHNICAL_DEBT_PROGRESS.md) — статус выполнения
- [Documentation Improvement Plan](./docs/DOCUMENTATION_IMPROVEMENT_PLAN.md) — ✅ реализован

## Статус проекта

- **Версия**: 2.3.0
- **Статус**: Production
- **Последнее обновление**: Декабрь 2024
- **Безопасность**: Enterprise-уровень с проактивным мониторингом (17 правил алертов)
- **Технический долг**: Минимальный (см. [TECHNICAL_DEBT_PROGRESS.md](./docs/TECHNICAL_DEBT_PROGRESS.md))

## Лицензия

MIT — см. [LICENSE](./LICENSE)

## Автор

**Chucha**
GitHub: [@Chucha-blog](https://github.com/Chucha-blog/crocodile)
Email: rockbandbugs@gmail.com

---

*Сделано с ❤️ — без алгоритмов, без манипуляций*
