# Onboarding Guide

> Версия: 1.0  
> Создан: Май 2025

---

## Добро пожаловать!

Этот гайд поможет вам начать работу с проектом NewsAggregator (Crocodile) за 1 час.

---

## День 1: Настройка окружения (1 час)

### Шаг 1: Установка зависимостей

**Требования:**
- Node.js 20+
- PostgreSQL 17+
- Redis 7+ (опционально)
- Git

**Проверка версий:**
```bash
node --version  # v20.x.x
npm --version   # 10.x.x
psql --version  # 17.x
redis-cli --version  # 7.x (опционально)
```

### Шаг 2: Клонирование репозитория

```bash
git clone https://github.com/Chucha-blog/blogpro.git
cd blogpro
npm install
```

### Шаг 3: Настройка БД

**Создание базы данных:**
```bash
psql -U postgres
```

```sql
CREATE DATABASE news_aggregator;
\q
```

### Шаг 4: Настройка .env

```bash
cp .env.example .env
```

**Минимальная конфигурация:**
```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgres://postgres:password@localhost:5432/news_aggregator
REDIS_URL=redis://localhost:6379

# Генерация ADMIN_TOKEN
ADMIN_TOKEN=<node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

# Web Push (опционально, для тестирования push-уведомлений)
# npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
PUSH_THRESHOLD=5

# NER Service (опционально, для Entity-Driven Cluster)
NER_SERVICE_URL=http://localhost:8001
```

**Генерация ADMIN_TOKEN:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Скопировать вывод в .env
```

### Шаг 5: Применение миграций

```bash
npx drizzle-kit migrate
```

**Ожидаемый вывод:**
```
✓ Migrations applied successfully
```

### Шаг 6: Запуск сервера

```bash
npm run dev
```

**Ожидаемый вывод:**
```
Server running on http://localhost:5000
Client running on http://localhost:5173
```

### Шаг 7: Открытие приложения

**Браузер:**
```
http://localhost:5173
```

**Проверка API:**
```bash
curl http://localhost:5000/api/health
# {"ok":true}
```

**Проверка админки:**
```bash
curl http://localhost:5000/api/admin/news/sources \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# {"success":true,"sources":[]}
```

### Шаг 8: Добавление первого источника

```bash
curl -X POST http://localhost:5000/api/admin/news/sources \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lenta.ru",
    "url": "https://lenta.ru",
    "rssUrl": "https://lenta.ru/rss",
    "region": "russia",
    "category": "other"
  }'
```

### Шаг 9: Запуск сбора

```bash
curl -X POST http://localhost:5000/api/admin/jobs/rss-collect \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"group": "all"}'
```

**Проверка результата:**
```bash
curl http://localhost:5000/api/news
# {"articles":[...], "hasMore":false}
```

### Шаг 10: Открытие кабинета мониторинга

```
http://localhost:5173/monitor
```

**Ввести ADMIN_TOKEN** → Просмотр статистики сбора.

---

## День 2: Изучение архитектуры (2-3 часа)

### Шаг 1: Прочитать README.md

```bash
cat README.md
```

**Ключевые разделы:**
- О проекте
- Ключевые возможности
- Технологический стек
- База данных

### Шаг 2: Изучить ARCHITECTURE.md

```bash
cat docs/ARCHITECTURE.md
```

**Ключевые разделы:**
- Архитектурные слои (DDD)
- Основные потоки данных
- Ключевые компоненты

### Шаг 3: Изучить диаграммы

**Потоки данных:**
```bash
cat docs/diagrams/DATA_FLOW.md
```

**C4 Architecture:**
```bash
cat docs/diagrams/C4_ARCHITECTURE.md
```

**Схема БД:**
```bash
cat docs/diagrams/DATABASE_SCHEMA.md
```

**Зависимости модулей:**
```bash
cat docs/diagrams/MODULE_DEPENDENCIES.md
```

### Шаг 4: Прочитать DEVELOPER_GUIDE.md

```bash
cat docs/DEVELOPER_GUIDE.md
```

**Ключевые разделы:**
- Навигация по коду
- Частые задачи
- API (кратко)

---

## День 3: Первая задача (2-3 часа)

### Задача: Добавить источник и проверить сбор

**Шаг 1: Выбрать источник**

Примеры:
- Habr: `https://habr.com/ru/rss/all/all/`
- RBC: `https://rssexport.rbc.ru/rbcnews/news/30/full.rss`

**Шаг 2: Добавить через API**

```bash
curl -X POST http://localhost:5000/api/admin/news/sources \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Habr",
    "url": "https://habr.com",
    "rssUrl": "https://habr.com/ru/rss/all/all/",
    "region": "russia",
    "category": "tech"
  }'
```

**Шаг 3: Запустить сбор**

```bash
curl -X POST http://localhost:5000/api/admin/jobs/rss-collect \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"group": "all"}'
```

**Шаг 4: Проверить статьи в БД**

```bash
psql $DATABASE_URL -c "SELECT id, title, source_id FROM news_articles ORDER BY published_at DESC LIMIT 5;"
```

**Шаг 5: Открыть ленту**

```
http://localhost:5173/?category=tech
```

---

## Неделя 1: Погружение в код (5-10 часов)

### День 1-2: Тесты

**Прочитать TESTING.md:**
```bash
cat docs/TESTING.md
```

**Запустить тесты:**
```bash
npm test
```

**Изучить тесты:**
- `server/__tests__/NewsCluster.test.ts` — Unit тесты кластеризации
- `server/__tests__/e2e/collect-and-serve.test.ts` — E2E тесты сбора
- `client/src/__tests__/offlineStore.test.ts` — Unit тесты офлайн-режима

### День 3-4: Основные компоненты

**Изучить файлы:**

**Сбор новостей:**
```typescript
// server/application/news/CollectNewsUseCase.ts
// Оркестрация сбора RSS
```

**Кластеризация:**
```typescript
// server/application/news/ClusterNewsUseCase.ts
// Группировка похожих новостей
```

**Entity-Driven Cluster:**
```typescript
// server/application/news/EntityClusterService.ts
// Поиск похожих по сущностям
```

**Прочитать гайды:**
- `docs/CLUSTERING_GUIDE.md` — токенная кластеризация
- `docs/NER_SERVICE_GUIDE.md` — Entity-Driven Cluster

### День 5: PWA и офлайн-режим

**Прочитать PWA_IMPLEMENTATION.md:**
```bash
cat docs/PWA_IMPLEMENTATION.md
```

**Изучить файлы:**
```typescript
// client/src/services/offlineStore.ts
// IndexedDB для офлайн-режима

// client/src/sw.ts
// Service Worker (push + precache)
```

**Тестирование офлайн-режима:**
1. Открыть DevTools → Network → Offline
2. Перезагрузить страницу
3. Лента должна загрузиться из IndexedDB

---

## Неделя 2: Первый коммит (5-10 часов)

### Шаг 1: Выбрать задачу

**Источники задач:**
- GitHub Issues: https://github.com/Chucha-blog/blogpro/issues
- Технический долг: `docs/TECHNICAL_DEBT_PLAN.md`
- Улучшения: `docs/IMPROVEMENT_PLAN_V3.md`

**Примеры задач для начинающих:**
- Добавить новый источник RSS
- Написать тест для существующего компонента
- Исправить опечатку в документации
- Добавить валидацию в API

### Шаг 2: Создать ветку

```bash
git checkout -b feature/add-new-source
```

**Naming convention:**
- `feature/` — новая функциональность
- `fix/` — исправление бага
- `docs/` — изменения в документации
- `test/` — добавление тестов

### Шаг 3: Написать код

**Пример: добавление нового источника**

```typescript
// server/scripts/add-source.ts
import { db } from '../infrastructure/persistence/db';
import { newsSources } from '../../shared/types/schema';

async function addSource() {
  await db.insert(newsSources).values({
    name: 'The Guardian Tech',
    url: 'https://theguardian.com',
    rssUrl: 'https://www.theguardian.com/technology/rss',
    region: 'world',
    category: 'tech',
    isActive: true
  });
  
  console.log('Source added successfully');
}

addSource();
```

### Шаг 4: Написать тесты

```typescript
// server/__tests__/add-source.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../infrastructure/persistence/db';
import { newsSources } from '../../shared/types/schema';

describe('Add Source', () => {
  beforeEach(async () => {
    await db.delete(newsSources);
  });

  it('should add source successfully', async () => {
    await db.insert(newsSources).values({
      name: 'Test Source',
      url: 'https://example.com',
      rssUrl: 'https://example.com/rss',
      region: 'russia',
      category: 'tech',
      isActive: true
    });

    const sources = await db.select().from(newsSources);
    expect(sources).toHaveLength(1);
    expect(sources[0].name).toBe('Test Source');
  });
});
```

### Шаг 5: Запустить тесты

```bash
npm test
```

**Все тесты должны пройти.**

### Шаг 6: Запустить линтер

```bash
npm run lint
```

**Исправить все ошибки.**

### Шаг 7: Создать коммит

```bash
git add .
git commit -m "feat: add The Guardian Tech source"
```

**Commit message format (Conventional Commits):**
- `feat:` — новая функциональность
- `fix:` — исправление бага
- `docs:` — изменения в документации
- `test:` — добавление тестов
- `refactor:` — рефакторинг без изменения функциональности
- `style:` — форматирование кода
- `chore:` — обновление зависимостей, конфигурации

### Шаг 8: Создать Pull Request

```bash
git push origin feature/add-new-source
```

**GitHub:**
1. Открыть репозиторий
2. Нажать "New Pull Request"
3. Выбрать ветку `feature/add-new-source`
4. Заполнить описание:
   - Что сделано
   - Как тестировать
   - Скриншоты (если UI)
5. Нажать "Create Pull Request"

### Шаг 9: Code Review

**Ожидать review от мейнтейнеров.**

**Возможные комментарии:**
- Исправить стиль кода
- Добавить тесты
- Обновить документацию
- Исправить баги

**Внести правки:**
```bash
# Внести изменения
git add .
git commit -m "fix: address review comments"
git push origin feature/add-new-source
```

### Шаг 10: Merge

**После одобрения review:**
- Мейнтейнер сделает merge в `main`
- Ваш код попадёт в production

**Поздравляем с первым коммитом! 🎉**

---

## Полезные ресурсы

### Документация

- [README.md](../README.md) — обзор проекта
- [ARCHITECTURE.md](./ARCHITECTURE.md) — архитектура системы
- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) — частые задачи
- [TESTING.md](./TESTING.md) — тесты и покрытие
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — типичные проблемы
- [PERFORMANCE.md](./PERFORMANCE.md) — оптимизация

### Специализированные гайды

- [NER_SERVICE_GUIDE.md](./NER_SERVICE_GUIDE.md) — Entity-Driven Cluster
- [CLUSTERING_GUIDE.md](./CLUSTERING_GUIDE.md) — токенная кластеризация
- [WEATHER_SYSTEM_GUIDE.md](./WEATHER_SYSTEM_GUIDE.md) — модуль погоды
- [PWA_IMPLEMENTATION.md](./PWA_IMPLEMENTATION.md) — офлайн-режим
- [API_KEYS_GUIDE.md](./API_KEYS_GUIDE.md) — управление API-ключами
- [AUTHENTICATION.md](./AUTHENTICATION.md) — аутентификация админки

### Диаграммы

- [DATA_FLOW.md](./diagrams/DATA_FLOW.md) — потоки данных
- [C4_ARCHITECTURE.md](./diagrams/C4_ARCHITECTURE.md) — C4-модель
- [DATABASE_SCHEMA.md](./diagrams/DATABASE_SCHEMA.md) — схема БД
- [MODULE_DEPENDENCIES.md](./diagrams/MODULE_DEPENDENCIES.md) — зависимости модулей

### Инструменты

- **Drizzle Studio:** `npx drizzle-kit studio` — веб-интерфейс для БД
- **Redis CLI:** `redis-cli` — интерфейс для Redis
- **psql:** `psql $DATABASE_URL` — интерфейс для PostgreSQL

---

## Чеклист онбординга

### День 1
- [ ] Установлены зависимости (Node.js, PostgreSQL, Redis)
- [ ] Клонирован репозиторий
- [ ] Создана БД
- [ ] Настроен .env
- [ ] Применены миграции
- [ ] Запущен сервер
- [ ] Добавлен первый источник
- [ ] Запущен сбор
- [ ] Открыт кабинет мониторинга

### День 2
- [ ] Прочитан README.md
- [ ] Прочитан ARCHITECTURE.md
- [ ] Изучены диаграммы
- [ ] Прочитан DEVELOPER_GUIDE.md

### День 3
- [ ] Добавлен источник через API
- [ ] Запущен сбор
- [ ] Проверены статьи в БД
- [ ] Открыта лента

### Неделя 1
- [ ] Прочитан TESTING.md
- [ ] Запущены тесты
- [ ] Изучены основные компоненты
- [ ] Прочитаны CLUSTERING_GUIDE.md и NER_SERVICE_GUIDE.md
- [ ] Прочитан PWA_IMPLEMENTATION.md
- [ ] Протестирован офлайн-режим

### Неделя 2
- [ ] Выбрана задача
- [ ] Создана ветка
- [ ] Написан код
- [ ] Написаны тесты
- [ ] Запущены тесты (все прошли)
- [ ] Запущен линтер (нет ошибок)
- [ ] Создан коммит
- [ ] Создан Pull Request
- [ ] Получен review
- [ ] Внесены правки
- [ ] Merge в main

---

## Контакты

- **GitHub:** https://github.com/Chucha-blog/blogpro
- **Email:** rockbandbugs@gmail.com
- **Issues:** https://github.com/Chucha-blog/blogpro/issues

---

**Добро пожаловать в команду! 🚀**
