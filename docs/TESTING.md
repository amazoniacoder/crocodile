# Testing Guide

> Версия: 1.0  
> Создан: Май 2025

---

## Обзор

**Фреймворк:** Vitest  
**Покрытие:** ~100 тестов (Unit + Integration + E2E)  
**Запуск:** `npm test`

---

## Структура тестов

```
server/__tests__/
├── NewsCluster.test.ts                    # Unit: правила кластеризации
├── NewsArticleRepository.test.ts          # Integration: фильтры, пагинация
├── OpenMeteoClient.test.ts                # Unit: API-клиент погоды
├── weather-week-api.test.ts               # Integration: GET /api/weather/week
├── auth/
│   ├── TokenManager.test.ts               # Unit: токены администраторов
│   └── ApiKeyService.test.ts              # Unit: API-ключи
├── monitoring/
│   ├── AlertManager.test.ts               # Integration: алерты
│   └── HealthMonitoring.test.ts           # Integration: здоровье системы
└── e2e/
    ├── collect-and-serve.test.ts          # E2E: сбор → GET /api/news
    └── full-cycle.test.ts                 # E2E: сбор → кластеризация → кэш

client/src/__tests__/
├── offlineStore.test.ts                   # Unit: IndexedDB офлайн-хранилище
└── weatherCache.test.ts                   # Unit: кэш погоды в IDB
```

---

## Запуск тестов

### Все тесты

```bash
npm test
```

### Только сервер

```bash
npm run test:server
```

### Только клиент

```bash
npm run test:client
```

### Конкретный файл

```bash
npm test -- NewsCluster.test.ts
```

### Watch mode

```bash
npm test -- --watch
```

### Coverage

```bash
npm test -- --coverage
```

---

## Unit Tests

### NewsCluster.test.ts (21 тест)

**Тестируемые функции:**
- `tokenize` — токенизация заголовка
- `titleSimilarity` — Jaccard similarity
- `areSimilar` — сравнение заголовков (сырые токены)
- `tokenizeNormalized` — нормализация через NER
- `areSimilarNormalized` — сравнение нормализованных заголовков

**Примеры тестов:**
```typescript
describe('tokenize', () => {
  it('should tokenize Russian text', () => {
    const tokens = tokenize('Трамп подписал указ о санкциях');
    expect(tokens).toEqual(['трамп', 'подписал', 'указ', 'санкциях']);
  });

  it('should filter short tokens', () => {
    const tokens = tokenize('Это и то');
    expect(tokens).toEqual([]); // все токены < 3 символов
  });
});

describe('areSimilarNormalized', () => {
  it('should match similar titles with different word forms', () => {
    const tokens1 = ['трамп', 'подписать', 'указ'];
    const tokens2 = ['указ', 'подписать', 'трамп'];
    expect(areSimilarNormalized(tokens1, tokens2, 0.6)).toBe(true);
  });

  it('should not match different titles', () => {
    const tokens1 = ['трамп', 'подписать', 'указ'];
    const tokens2 = ['путин', 'провести', 'встреча'];
    expect(areSimilarNormalized(tokens1, tokens2, 0.6)).toBe(false);
  });
});
```

### TokenManager.test.ts (15+ тестов)

**Тестируемые методы:**
- `createToken` — создание токена
- `validateToken` — валидация токена
- `revokeToken` — отзыв токена
- `rotateToken` — ротация токена
- `cleanupExpiredTokens` — очистка истёкших

**Примеры тестов:**
```typescript
describe('TokenManager', () => {
  it('should create and validate token', async () => {
    const { token, tokenData } = await tokenManager.createToken('admin', 3600);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    
    const validated = await tokenManager.validateToken(token);
    expect(validated).toBeTruthy();
    expect(validated?.name).toBe('admin');
  });

  it('should reject expired token', async () => {
    const { token } = await tokenManager.createToken('admin', 1); // 1 секунда
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const validated = await tokenManager.validateToken(token);
    expect(validated).toBeNull();
  });

  it('should rotate token with grace period', async () => {
    const { token: oldToken } = await tokenManager.createToken('admin', 3600);
    const { token: newToken } = await tokenManager.rotateToken(oldToken, 60);
    
    // Оба токена валидны в течение grace period
    expect(await tokenManager.validateToken(oldToken)).toBeTruthy();
    expect(await tokenManager.validateToken(newToken)).toBeTruthy();
  });
});
```

### ApiKeyService.test.ts (20+ тестов)

**Тестируемые методы:**
- `createKey` — создание ключа
- `validateKey` — валидация ключа
- `revokeKey` — отзыв ключа
- `listKeys` — список ключей
- `updateLastUsed` — обновление last_used_at

**Примеры тестов:**
```typescript
describe('ApiKeyService', () => {
  it('should create key with na_ prefix', async () => {
    const { key, keyData } = await apiKeyService.createKey('Test App', 120);
    expect(key).toMatch(/^na_[a-f0-9]{48}$/);
    expect(keyData.name).toBe('Test App');
    expect(keyData.requestsPerMinute).toBe(120);
  });

  it('should validate key and cache result', async () => {
    const { key } = await apiKeyService.createKey('Test', 60);
    
    // Первая валидация — запрос к БД
    const validated1 = await apiKeyService.validateKey(key);
    expect(validated1).toBeTruthy();
    
    // Вторая валидация — из кэша
    const validated2 = await apiKeyService.validateKey(key);
    expect(validated2).toBeTruthy();
  });

  it('should reject revoked key', async () => {
    const { key, keyData } = await apiKeyService.createKey('Test', 60);
    await apiKeyService.revokeKey(keyData.id);
    
    const validated = await apiKeyService.validateKey(key);
    expect(validated).toBeNull();
  });
});
```

---

## Integration Tests

### NewsArticleRepository.test.ts (8 тестов)

**Тестируемые методы:**
- `findMany` — фильтры, пагинация, мультикатегория

**Примеры тестов:**
```typescript
describe('NewsArticleRepository', () => {
  beforeEach(async () => {
    // Очистка БД
    await db.delete(newsArticles);
    
    // Вставка тестовых данных
    await db.insert(newsArticles).values([
      { title: 'Tech news', region: 'russia', category: 'tech', publishedAt: new Date() },
      { title: 'Economy news', region: 'russia', category: 'economy', publishedAt: new Date() },
      { title: 'World news', region: 'world', category: 'politics', publishedAt: new Date() }
    ]);
  });

  it('should filter by region', async () => {
    const result = await repository.findMany({ region: 'russia', page: 1, limit: 10 });
    expect(result.articles).toHaveLength(2);
    expect(result.articles.every(a => a.region === 'russia')).toBe(true);
  });

  it('should filter by multiple categories', async () => {
    const result = await repository.findMany({ 
      region: 'russia', 
      category: ['tech', 'economy'], 
      page: 1, 
      limit: 10 
    });
    expect(result.articles).toHaveLength(2);
  });

  it('should paginate correctly', async () => {
    const page1 = await repository.findMany({ page: 1, limit: 1 });
    const page2 = await repository.findMany({ page: 2, limit: 1 });
    
    expect(page1.articles).toHaveLength(1);
    expect(page2.articles).toHaveLength(1);
    expect(page1.articles[0].id).not.toBe(page2.articles[0].id);
  });
});
```

### AlertManager.test.ts (15+ тестов)

**Тестируемые методы:**
- `checkRules` — проверка правил
- `getActiveAlerts` — активные алерты
- `acknowledgeAlert` — подтверждение алерта
- `getAlertHistory` — история алертов

**Примеры тестов:**
```typescript
describe('AlertManager', () => {
  it('should trigger alert when RSS collection fails', async () => {
    const metrics = {
      rss: { healthy: false, lastError: 'Connection timeout' }
    };
    
    await alertManager.checkRules(metrics);
    const alerts = await alertManager.getActiveAlerts();
    
    expect(alerts).toHaveLength(1);
    expect(alerts[0].ruleId).toBe('rss_collection_failure');
    expect(alerts[0].severity).toBe('high');
  });

  it('should resolve alert when issue fixed', async () => {
    // Триггер алерта
    await alertManager.checkRules({ rss: { healthy: false } });
    
    // Исправление проблемы
    await alertManager.checkRules({ rss: { healthy: true } });
    
    const alerts = await alertManager.getActiveAlerts();
    expect(alerts).toHaveLength(0);
  });

  it('should respect cooldown period', async () => {
    await alertManager.checkRules({ rss: { healthy: false } });
    await alertManager.checkRules({ rss: { healthy: false } });
    
    const history = await alertManager.getAlertHistory();
    expect(history.filter(a => a.ruleId === 'rss_collection_failure')).toHaveLength(1);
  });
});
```

---

## E2E Tests

### collect-and-serve.test.ts (4 теста)

**Сценарий:** сбор → сохранение → GET /api/news

```typescript
describe('E2E: Collect and Serve', () => {
  it('should collect articles and serve via API', async () => {
    // 1. Вставка источника
    const source = await db.insert(newsSources).values({
      name: 'Test Source',
      url: 'https://example.com',
      rssUrl: 'https://example.com/rss',
      region: 'russia',
      category: 'tech',
      isActive: true
    }).returning();

    // 2. Вставка статей
    await db.insert(newsArticles).values([
      { sourceId: source[0].id, title: 'Article 1', url: 'https://example.com/1', publishedAt: new Date(), region: 'russia', category: 'tech' },
      { sourceId: source[0].id, title: 'Article 2', url: 'https://example.com/2', publishedAt: new Date(), region: 'russia', category: 'tech' }
    ]);

    // 3. Запрос к API
    const response = await request(app)
      .get('/api/news?region=russia&category=tech')
      .expect(200);

    expect(response.body.articles).toHaveLength(2);
    expect(response.body.hasMore).toBe(false);
  });

  it('should deduplicate by URL', async () => {
    const url = 'https://example.com/duplicate';
    
    // Первая вставка
    await db.insert(newsArticles).values({
      title: 'Article', url, publishedAt: new Date(), region: 'russia', category: 'tech'
    });

    // Вторая вставка (дубликат)
    const result = await db.insert(newsArticles).values({
      title: 'Article', url, publishedAt: new Date(), region: 'russia', category: 'tech'
    }).onConflictDoNothing();

    expect(result.rowCount).toBe(0); // Дубликат отклонён
  });
});
```

### full-cycle.test.ts (4 теста)

**Сценарий:** сбор → кластеризация → уведомления → кэш

```typescript
describe('E2E: Full Cycle', () => {
  it('should complete full news cycle', async () => {
    // 1. Сбор
    const collectResult = await collectNewsUseCase.execute('all');
    expect(collectResult.insertedCount).toBeGreaterThan(0);

    // 2. Кластеризация
    await clusterNewsUseCase.execute();
    const clustered = await db.select().from(newsArticles).where(isNotNull(newsArticles.clusterId));
    expect(clustered.length).toBeGreaterThan(0);

    // 3. Кэш
    const response1 = await request(app).get('/api/news');
    expect(response1.headers['x-cache']).toBe('MISS');

    const response2 = await request(app).get('/api/news');
    expect(response2.headers['x-cache']).toBe('HIT');

    // 4. Инвалидация
    eventBus.emit('articles.collected', { insertedCount: 1 });
    await new Promise(resolve => setTimeout(resolve, 100));

    const response3 = await request(app).get('/api/news');
    expect(response3.headers['x-cache']).toBe('MISS');
  });
});
```

---

## Client Tests

### offlineStore.test.ts (17 тестов)

**Тестируемые функции:**
- `saveFeedSlice` — сохранение ленты
- `loadFeedSlice` — загрузка ленты
- `saveArticleDetails` — сохранение деталей
- `loadArticleDetails` — загрузка деталей
- `addPendingAction` — добавление офлайн-действия
- `getPendingActions` — получение очереди
- `removePendingAction` — удаление из очереди
- `runGarbageCollection` — GC

**Примеры тестов:**
```typescript
describe('offlineStore', () => {
  beforeEach(async () => {
    await db.articles.clear();
    await db.feedSlices.clear();
    await db.pendingActions.clear();
  });

  it('should save and load feed slice', async () => {
    const articles = [
      { id: 1, title: 'Article 1', url: 'https://example.com/1', publishedAt: new Date().toISOString() },
      { id: 2, title: 'Article 2', url: 'https://example.com/2', publishedAt: new Date().toISOString() }
    ];

    await saveFeedSlice({ region: 'russia', category: 'tech' }, articles);
    const loaded = await loadFeedSlice({ region: 'russia', category: 'tech' });

    expect(loaded).toHaveLength(2);
    expect(loaded[0].title).toBe('Article 1');
  });

  it('should run GC when limit exceeded', async () => {
    // Вставка 3001 статьи (лимит 3000)
    const articles = Array.from({ length: 3001 }, (_, i) => ({
      id: i,
      title: `Article ${i}`,
      url: `https://example.com/${i}`,
      publishedAt: new Date(Date.now() - i * 1000).toISOString()
    }));

    for (const article of articles) {
      await db.articles.add(article);
    }

    await runGarbageCollection();

    const count = await db.articles.count();
    expect(count).toBeLessThanOrEqual(3000);
  });

  it('should queue pending action', async () => {
    await addPendingAction({ type: 'reaction', articleId: 1, data: { type: 'like' } });
    const pending = await getPendingActions();

    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('reaction');
  });
});
```

---

## Написание новых тестов

### Unit Test Template

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { myFunction } from '../path/to/module';

describe('myFunction', () => {
  beforeEach(() => {
    // Подготовка
  });

  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });

  it('should handle edge case', () => {
    const result = myFunction('');
    expect(result).toBeNull();
  });
});
```

### Integration Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../infrastructure/persistence/db';
import { myTable } from '../../shared/types/schema';

describe('MyRepository', () => {
  beforeEach(async () => {
    await db.delete(myTable);
  });

  afterEach(async () => {
    await db.delete(myTable);
  });

  it('should insert and retrieve', async () => {
    await db.insert(myTable).values({ name: 'Test' });
    const result = await db.select().from(myTable);
    expect(result).toHaveLength(1);
  });
});
```

### E2E Test Template

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index';

describe('GET /api/endpoint', () => {
  it('should return 200', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .expect(200);

    expect(response.body).toHaveProperty('data');
  });

  it('should require authentication', async () => {
    await request(app)
      .get('/api/admin/endpoint')
      .expect(401);
  });
});
```

---

## Mocking

### Mock NER Service

```typescript
import { vi } from 'vitest';

const mockNerService = {
  extractEntities: vi.fn().mockResolvedValue([
    { PER: ['Трамп'], ORG: [], LOC: ['Россия'] }
  ]),
  normalizeTexts: vi.fn().mockResolvedValue([
    ['трамп', 'подписать', 'указ']
  ])
};
```

### Mock Redis

```typescript
const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1)
};
```

### Mock EventBus

```typescript
const mockEventBus = {
  emit: vi.fn(),
  on: vi.fn()
};
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      
      - run: npm install
      - run: npx drizzle-kit migrate
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/test
      
      - run: npm test
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379
```

---

## Coverage Goals

| Модуль | Цель | Текущее |
|--------|------|---------|
| Domain Layer | 100% | 95% |
| Application Layer | 90% | 85% |
| Infrastructure Layer | 80% | 75% |
| API Layer | 85% | 80% |
| Client Services | 80% | 75% |

---

> См. также: [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
