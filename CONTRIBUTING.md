# Contributing Guide

> Версия: 1.0  
> Создан: Май 2025

---

## Добро пожаловать!

Спасибо за интерес к проекту NewsAggregator (Crocodile)! Этот документ описывает процесс внесения изменений.

---

## Code of Conduct

Мы придерживаемся принципов уважения и профессионализма. Ожидаем того же от всех участников.

**Недопустимо:**
- Оскорбления и личные нападки
- Дискриминация по любому признаку
- Спам и реклама
- Публикация чужих личных данных

**Нарушения:** ban без предупреждения.

---

## Как внести вклад

### 1. Найти задачу

**Источники:**
- [GitHub Issues](https://github.com/Chucha-blog/blogpro/issues) — открытые задачи
- [TECHNICAL_DEBT_PLAN.md](./TECHNICAL_DEBT_PLAN.md) — технический долг
- Собственная идея — создать Issue для обсуждения

**Метки Issues:**
- `good first issue` — для новичков
- `bug` — исправление бага
- `enhancement` — новая функциональность
- `documentation` — улучшение документации
- `help wanted` — нужна помощь

### 2. Создать Issue (для новых идей)

**Шаблон:**
```markdown
## Описание
Краткое описание проблемы или идеи.

## Мотивация
Зачем это нужно?

## Предлагаемое решение
Как это реализовать?

## Альтернативы
Какие ещё варианты рассматривались?
```

**Ожидать обсуждения** перед началом работы.

### 3. Fork репозитория

```bash
# GitHub: нажать "Fork"
git clone https://github.com/YOUR_USERNAME/blogpro.git
cd blogpro
git remote add upstream https://github.com/Chucha-blog/blogpro.git
```

### 4. Создать ветку

```bash
git checkout -b feature/your-feature-name
```

**Naming convention:**
- `feature/` — новая функциональность
- `fix/` — исправление бага
- `docs/` — изменения в документации
- `test/` — добавление тестов
- `refactor/` — рефакторинг
- `chore/` — обновление зависимостей, конфигурации

**Примеры:**
- `feature/add-twitter-source`
- `fix/cluster-similarity-threshold`
- `docs/update-api-guide`
- `test/add-entity-cluster-tests`

### 5. Написать код

**Следовать стилю проекта:**
- TypeScript для нового кода
- BEM для CSS (см. `client/src/ui-system/`)
- DDD layers (Domain → Application → Infrastructure → API)
- Правило изоляции Domain Layer

**Прочитать:**
- [ARCHITECTURE.md](./ARCHITECTURE.md) — архитектура
- [MODULE_DEPENDENCIES.md](./diagrams/MODULE_DEPENDENCIES.md) — правила импорта

### 6. Написать тесты

**Обязательно для:**
- Новой функциональности
- Исправления багов

**Типы тестов:**
- Unit — чистые функции, бизнес-логика
- Integration — взаимодействие с БД, Redis
- E2E — полный цикл (сбор → кластеризация → API)

**Прочитать:**
- [TESTING.md](./TESTING.md) — структура тестов, шаблоны

**Запуск:**
```bash
npm test
```

### 7. Запустить линтер

```bash
npm run lint
```

**Исправить все ошибки.**

**Автоматическое исправление:**
```bash
npm run lint:fix
```

### 8. Обновить документацию

**Обязательно для:**
- Новых API эндпоинтов
- Изменения поведения существующих функций
- Новых конфигурационных параметров

**Файлы:**
- `README.md` — обзор проекта
- `docs/DEVELOPER_GUIDE.md` — частые задачи
- `docs/ARCHITECTURE.md` — архитектура
- Специализированные гайды (NER, PWA, Weather и т.д.)

### 9. Создать коммит

```bash
git add .
git commit -m "feat: add Twitter source support"
```

**Commit message format (Conventional Commits):**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` — новая функциональность
- `fix` — исправление бага
- `docs` — изменения в документации
- `test` — добавление тестов
- `refactor` — рефакторинг без изменения функциональности
- `style` — форматирование кода
- `chore` — обновление зависимостей, конфигурации
- `perf` — оптимизация производительности

**Scope (опционально):**
- `api` — изменения в API
- `ui` — изменения в UI
- `db` — изменения в БД
- `docs` — документация

**Примеры:**
```
feat(api): add Twitter source support
fix(cluster): correct similarity threshold calculation
docs(readme): update installation instructions
test(entity): add tests for entity extraction
refactor(cache): simplify cache invalidation logic
```

**Breaking changes:**
```
feat(api)!: change news list response format

BREAKING CHANGE: articles field renamed to items
```

### 10. Push в fork

```bash
git push origin feature/your-feature-name
```

### 11. Создать Pull Request

**GitHub:**
1. Открыть свой fork
2. Нажать "New Pull Request"
3. Выбрать ветку `feature/your-feature-name`
4. Заполнить описание

**Шаблон PR:**
```markdown
## Описание
Краткое описание изменений.

## Связанные Issues
Closes #123

## Тип изменений
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Как тестировать
1. Шаг 1
2. Шаг 2
3. Ожидаемый результат

## Чеклист
- [ ] Код следует стилю проекта
- [ ] Написаны тесты
- [ ] Все тесты проходят
- [ ] Линтер не выдаёт ошибок
- [ ] Документация обновлена
- [ ] Коммиты следуют Conventional Commits

## Скриншоты (если UI)
```

### 12. Code Review

**Ожидать review от мейнтейнеров.**

**Возможные комментарии:**
- Исправить стиль кода
- Добавить тесты
- Обновить документацию
- Исправить баги
- Улучшить производительность

**Внести правки:**
```bash
# Внести изменения
git add .
git commit -m "fix: address review comments"
git push origin feature/your-feature-name
```

**PR автоматически обновится.**

### 13. Merge

**После одобрения:**
- Мейнтейнер сделает merge в `main`
- Ваш код попадёт в production

**Поздравляем! 🎉**

---

## Code Style

### TypeScript

**Используйте:**
- Строгую типизацию (`strict: true`)
- Интерфейсы вместо `any`
- `const` вместо `let` где возможно
- Async/await вместо callbacks

**Не используйте:**
- `any` (используйте `unknown` или конкретный тип)
- `var` (используйте `const` или `let`)
- `==` (используйте `===`)

**Примеры:**

**✅ Хорошо:**
```typescript
interface NewsArticle {
  id: number;
  title: string;
  publishedAt: Date;
}

async function fetchArticles(): Promise<NewsArticle[]> {
  const response = await fetch('/api/news');
  const data = await response.json();
  return data.articles;
}
```

**❌ Плохо:**
```typescript
function fetchArticles(callback: any) {
  fetch('/api/news').then(response => {
    response.json().then(data => {
      callback(data.articles);
    });
  });
}
```

### CSS (BEM)

**Структура:**
```
Block__Element--Modifier
```

**Примеры:**
```css
/* Block */
.news-card { }

/* Element */
.news-card__title { }
.news-card__description { }

/* Modifier */
.news-card--featured { }
.news-card__title--large { }
```

**Файлы стилей:**
```
client/src/ui-system/
├── base/
│   ├── reset.css
│   └── typography.css
├── components/
│   ├── buttons.css
│   └── cards.css
└── patterns/
    ├── news-feed.css
    └── weather.css
```

### Именование

**Файлы:**
- `PascalCase.ts` — компоненты React
- `camelCase.ts` — утилиты, сервисы
- `kebab-case.css` — стили

**Переменные:**
- `camelCase` — обычные переменные
- `UPPER_SNAKE_CASE` — константы
- `PascalCase` — классы, интерфейсы, типы

**Примеры:**
```typescript
const API_URL = 'https://api.example.com';
const maxRetries = 3;

interface NewsArticle { }
class ArticleRepository { }
```

---

## Тестирование

### Unit Tests

**Что тестировать:**
- Чистые функции
- Бизнес-логика (Domain Layer)
- Утилиты

**Пример:**
```typescript
import { describe, it, expect } from 'vitest';
import { tokenize } from '../domain/news/NewsCluster';

describe('tokenize', () => {
  it('should tokenize Russian text', () => {
    const tokens = tokenize('Трамп подписал указ');
    expect(tokens).toEqual(['трамп', 'подписал', 'указ']);
  });
});
```

### Integration Tests

**Что тестировать:**
- Взаимодействие с БД
- Взаимодействие с Redis
- Взаимодействие с внешними API

**Пример:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../infrastructure/persistence/db';
import { newsArticles } from '../../shared/types/schema';

describe('NewsArticleRepository', () => {
  beforeEach(async () => {
    await db.delete(newsArticles);
  });

  it('should insert and retrieve article', async () => {
    await db.insert(newsArticles).values({
      title: 'Test',
      url: 'https://example.com/1',
      publishedAt: new Date(),
      region: 'russia',
      category: 'tech'
    });

    const articles = await db.select().from(newsArticles);
    expect(articles).toHaveLength(1);
  });
});
```

### E2E Tests

**Что тестировать:**
- Полный цикл (сбор → кластеризация → API)
- HTTP API эндпоинты

**Пример:**
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index';

describe('GET /api/news', () => {
  it('should return articles', async () => {
    const response = await request(app)
      .get('/api/news')
      .expect(200);

    expect(response.body).toHaveProperty('articles');
    expect(response.body).toHaveProperty('hasMore');
  });
});
```

---

## Документация

### Когда обновлять

**Обязательно:**
- Новые API эндпоинты
- Изменение поведения существующих функций
- Новые конфигурационные параметры
- Новые зависимости

**Желательно:**
- Рефакторинг архитектуры
- Оптимизация производительности
- Исправление багов (если не очевидно)

### Какие файлы обновлять

**Новый API эндпоинт:**
- `docs/DEVELOPER_GUIDE.md` — добавить в таблицу API
- `docs/ARCHITECTURE.md` — если меняется поток данных

**Новая функциональность:**
- `README.md` — добавить в "Ключевые возможности"
- Создать специализированный гайд (если большая функциональность)
- Обновить `docs/ARCHITECTURE.md`

**Изменение БД:**
- `docs/DATABASE_ARCHITECTURE.md` — обновить схему
- `docs/diagrams/DATABASE_SCHEMA.md` — обновить ER-диаграмму

**Новая зависимость:**
- `docs/diagrams/MODULE_DEPENDENCIES.md` — добавить в список

---

## Pull Request Review Process

### Что проверяют мейнтейнеры

**Код:**
- Соответствие стилю проекта
- Правильность реализации
- Отсутствие багов
- Производительность
- Безопасность

**Тесты:**
- Наличие тестов
- Покрытие новой функциональности
- Все тесты проходят

**Документация:**
- Обновлена ли документация
- Понятно ли описание изменений

**Коммиты:**
- Следуют ли Conventional Commits
- Логичное разбиение на коммиты

### Сроки review

**Обычно:** 1-3 дня  
**Срочные (bug fix):** в течение дня  
**Большие PR:** до недели

### Что делать, если review затягивается

**Напомнить в комментарии к PR:**
```
@maintainer Gentle ping for review 🙂
```

**Если нет ответа 7 дней:**
- Написать в Issues
- Написать на email: rockbandbugs@gmail.com

---

## Reporting Bugs

### Перед созданием Issue

**Проверить:**
1. Баг воспроизводится на последней версии `main`
2. Баг не дублирует существующий Issue
3. Прочитан [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### Шаблон Bug Report

```markdown
## Описание
Краткое описание бага.

## Шаги воспроизведения
1. Шаг 1
2. Шаг 2
3. Шаг 3

## Ожидаемое поведение
Что должно произойти.

## Фактическое поведение
Что происходит на самом деле.

## Окружение
- OS: Windows 11 / macOS 14 / Ubuntu 22.04
- Node.js: 20.x.x
- PostgreSQL: 17.x
- Redis: 7.x (если используется)
- Браузер: Chrome 120 / Firefox 121 / Safari 17

## Логи
```
Вставить логи из консоли или файла logs/app.log
```

## Скриншоты
Если применимо.
```

---

## Feature Requests

### Шаблон Feature Request

```markdown
## Описание
Краткое описание функциональности.

## Мотивация
Какую проблему решает?

## Предлагаемое решение
Как это должно работать?

## Альтернативы
Какие ещё варианты рассматривались?

## Дополнительный контекст
Скриншоты, примеры из других проектов и т.д.
```

---

## Лицензия

Внося вклад в проект, вы соглашаетесь с тем, что ваш код будет распространяться под лицензией MIT.

---

## Контакты

- **GitHub Issues:** https://github.com/Chucha-blog/blogpro/issues
- **Email:** rockbandbugs@gmail.com

---

**Спасибо за вклад в проект! 🚀**
