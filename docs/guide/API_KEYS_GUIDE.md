# API Keys Guide

> Версия: 1.0  
> Создан: Май 2025

---

## Обзор

Система API-ключей для публичного API с настраиваемым rate limiting. Позволяет внешним приложениям (Telegram-боты, RSS-ридеры, мобильные приложения) получать доступ к API с индивидуальными лимитами.

**Без ключа:** 120 req/мин по IP  
**С ключом:** настраиваемый лимит (default: 60 req/мин, 10,000 req/день)

---

## Архитектура

### Компоненты

```
┌─────────────────────────────────────────┐
│         Client Application              │
│  (Telegram Bot, RSS Reader, Mobile App) │
└─────────────────────────────────────────┘
              ↓ X-Api-Key: na_...
┌─────────────────────────────────────────┐
│       apiKeyAuth Middleware             │
│  • Извлечение ключа (header/query)      │
│  • Валидация через ApiKeyService        │
│  • Rate limiting (express-rate-limit)   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│         ApiKeyService                   │
│  • Валидация с Redis-кэшем (5 мин)      │
│  • Обновление last_used_at              │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│      PostgreSQL: api_keys               │
│  • key_hash (SHA-256)                   │
│  • requests_per_minute                  │
│  • requests_per_day                     │
└─────────────────────────────────────────┘
```

### Таблица api_keys

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  key_hash VARCHAR(64) UNIQUE NOT NULL,  -- SHA-256 от ключа
  name VARCHAR(100) NOT NULL,            -- Название приложения
  created_at TIMESTAMP NOT NULL,
  last_used_at TIMESTAMP,                -- Обновляется при каждом запросе
  is_active BOOLEAN NOT NULL DEFAULT true,
  requests_per_minute INTEGER NOT NULL DEFAULT 60,
  requests_per_day INTEGER NOT NULL DEFAULT 10000
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
```

---

## Создание ключа

### Через API

```bash
curl -X POST http://localhost:5000/api/admin/api-keys \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Telegram Bot",
    "requestsPerMinute": 120,
    "requestsPerDay": 50000
  }'
```

**Ответ:**
```json
{
  "success": true,
  "key": "na_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
  "keyData": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Telegram Bot",
    "createdAt": "2025-05-15T10:30:00.000Z",
    "isActive": true,
    "requestsPerMinute": 120,
    "requestsPerDay": 50000
  }
}
```

**⚠️ ВАЖНО:** Ключ показывается **только один раз**. Сохраните его в безопасном месте.

### Формат ключа

```
na_<48 hex characters>
```

**Пример:**
```
na_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

**Генерация:**
```typescript
const key = `na_${crypto.randomBytes(24).toString('hex')}`;
// na_ — префикс для идентификации
// 24 bytes = 48 hex characters
```

**Хранение:**
```typescript
const keyHash = crypto.createHash('sha256').update(key).digest('hex');
// Сохраняется только хэш, сам ключ не хранится
```

---

## Использование ключа

### Заголовок X-Api-Key

```bash
curl http://localhost:5000/api/news \
  -H "X-Api-Key: na_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
```

### Query параметр

```bash
curl "http://localhost:5000/api/news?api_key=na_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
```

**Рекомендация:** использовать заголовок (безопаснее, не попадает в логи).

---

## Rate Limiting

### Без ключа

```typescript
// 120 req/мин по IP
rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => req.ip
});
```

### С ключом

```typescript
// Лимит из api_keys.requests_per_minute
rateLimit({
  windowMs: 60 * 1000,
  max: (req) => req.apiKeyData.requestsPerMinute,
  keyGenerator: (req) => req.apiKeyData.id
});
```

### Заголовки ответа

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 115
X-RateLimit-Reset: 1684152000
```

### При превышении лимита

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "error": "Too many requests, please try again later."
}
```

---

## Управление ключами

### Список ключей

```bash
curl http://localhost:5000/api/admin/api-keys \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Ответ:**
```json
{
  "success": true,
  "keys": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Telegram Bot",
      "createdAt": "2025-05-15T10:30:00.000Z",
      "lastUsedAt": "2025-05-15T12:45:00.000Z",
      "isActive": true,
      "requestsPerMinute": 120,
      "requestsPerDay": 50000
    }
  ]
}
```

### Обновление лимитов

```bash
curl -X PATCH http://localhost:5000/api/admin/api-keys/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestsPerMinute": 200,
    "requestsPerDay": 100000
  }'
```

### Отзыв ключа

```bash
curl -X DELETE http://localhost:5000/api/admin/api-keys/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Эффект:**
- `is_active` устанавливается в `false`
- Ключ перестаёт работать немедленно
- Кэш инвалидируется

### Восстановление ключа

```bash
curl -X PATCH http://localhost:5000/api/admin/api-keys/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": true}'
```

---

## Кэширование

### Redis-кэш валидации

```typescript
// Ключ: apikey:{hash}
// TTL: 5 минут
// Значение: {id, name, requestsPerMinute, requestsPerDay, isActive}
```

**Преимущества:**
- Валидация без запроса к БД
- Снижение нагрузки на PostgreSQL
- Быстрый ответ (< 1ms)

**Инвалидация:**
- При отзыве ключа
- При обновлении лимитов
- Автоматически через TTL (5 мин)

### Fallback на БД

```typescript
// Если Redis недоступен
const keyData = await db.select()
  .from(apiKeys)
  .where(eq(apiKeys.keyHash, keyHash))
  .limit(1);
```

---

## Мониторинг

### Статистика использования

```bash
curl http://localhost:5000/api/admin/api-keys/550e8400-e29b-41d4-a716-446655440000/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Ответ:**
```json
{
  "success": true,
  "stats": {
    "totalRequests": 15420,
    "requestsToday": 1250,
    "lastUsedAt": "2025-05-15T12:45:00.000Z",
    "averageRequestsPerDay": 1850,
    "utilizationPercent": 12.5
  }
}
```

### Кабинет мониторинга (Zone J)

**Доступ:** `/monitor` → вкладка "API Keys"

**Метрики:**
- Список всех ключей
- Последнее использование
- Статус (активен/отозван)
- Лимиты
- Кнопки управления (отзыв, восстановление)

---

## Безопасность

### Хранение ключа

**❌ Не делайте:**
```typescript
// Хранение ключа в открытом виде
await db.insert(apiKeys).values({ key: 'na_...' });
```

**✅ Делайте:**
```typescript
// Хранение только хэша
const keyHash = crypto.createHash('sha256').update(key).digest('hex');
await db.insert(apiKeys).values({ keyHash });
```

### Передача ключа

**❌ Не делайте:**
```bash
# Query параметр попадает в логи
curl "http://example.com/api/news?api_key=na_..."
```

**✅ Делайте:**
```bash
# Заголовок не попадает в стандартные логи
curl http://example.com/api/news \
  -H "X-Api-Key: na_..."
```

### Ротация ключей

```bash
# 1. Создать новый ключ
NEW_KEY=$(curl -X POST http://localhost:5000/api/admin/api-keys \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Telegram Bot v2", "requestsPerMinute": 120}' \
  | jq -r '.key')

# 2. Обновить приложение с новым ключом
# 3. Отозвать старый ключ
curl -X DELETE http://localhost:5000/api/admin/api-keys/OLD_KEY_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Рекомендация:** ротация каждые 90 дней.

---

## Примеры интеграции

### JavaScript / Node.js

```javascript
const API_KEY = 'na_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
const API_URL = 'https://example.com/api/news';

async function fetchNews() {
  const response = await fetch(API_URL, {
    headers: {
      'X-Api-Key': API_KEY
    }
  });
  
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    console.log(`Rate limited. Retry after ${retryAfter} seconds`);
    return;
  }
  
  const data = await response.json();
  return data.articles;
}
```

### Python

```python
import requests

API_KEY = 'na_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6'
API_URL = 'https://example.com/api/news'

def fetch_news():
    headers = {'X-Api-Key': API_KEY}
    response = requests.get(API_URL, headers=headers)
    
    if response.status_code == 429:
        retry_after = response.headers.get('Retry-After')
        print(f'Rate limited. Retry after {retry_after} seconds')
        return None
    
    response.raise_for_status()
    return response.json()['articles']
```

### cURL

```bash
#!/bin/bash

API_KEY="na_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
API_URL="https://example.com/api/news"

curl -s "$API_URL" \
  -H "X-Api-Key: $API_KEY" \
  | jq '.articles[] | {title, url}'
```

---

## Лучшие практики

### 1. Один ключ на приложение

```
✅ Telegram Bot — ключ 1
✅ RSS Reader — ключ 2
✅ Mobile App — ключ 3

❌ Все приложения — один ключ
```

**Причина:** изоляция, отзыв одного ключа не влияет на другие.

### 2. Хранение ключа в переменных окружения

```bash
# .env
API_KEY=na_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

```javascript
const API_KEY = process.env.API_KEY;
```

**❌ Не коммитить в Git:**
```gitignore
.env
.env.local
```

### 3. Обработка ошибок

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      continue;
    }
    
    if (response.ok) return response.json();
    
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  throw new Error('Max retries exceeded');
}
```

### 4. Мониторинг использования

```javascript
// Логирование запросов
console.log(`[${new Date().toISOString()}] API request: ${url}`);

// Алерт при приближении к лимиту
const remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));
const limit = parseInt(response.headers.get('X-RateLimit-Limit'));

if (remaining < limit * 0.1) {
  console.warn(`Rate limit warning: ${remaining}/${limit} remaining`);
}
```

---

## Troubleshooting

### Ключ не работает

**Проверка:**
```bash
curl http://localhost:5000/api/news \
  -H "X-Api-Key: na_..." \
  -v
```

**Возможные причины:**
1. Ключ отозван (`is_active = false`)
2. Неправильный формат (должен начинаться с `na_`)
3. Ключ не существует
4. Опечатка в ключе

**Решение:**
```bash
# Проверить статус ключа
curl http://localhost:5000/api/admin/api-keys \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.keys[] | select(.name == "My App")'
```

### Rate limit превышен

**Симптомы:**
```
HTTP/1.1 429 Too Many Requests
```

**Решение:**
1. Подождать `Retry-After` секунд
2. Увеличить лимит через админку
3. Оптимизировать запросы (кэширование на стороне клиента)

### Медленная валидация

**Симптомы:**
- Запросы с ключом медленнее, чем без ключа

**Проверка:**
```bash
# Проверить Redis
redis-cli ping
# Ожидается: PONG
```

**Решение:**
- Запустить Redis (валидация будет кэшироваться)
- Без Redis валидация идёт через БД (медленнее)

---

## API Reference

### POST /api/admin/api-keys

Создание нового ключа.

**Request:**
```json
{
  "name": "string",
  "requestsPerMinute": 60,
  "requestsPerDay": 10000
}
```

**Response:**
```json
{
  "success": true,
  "key": "na_...",
  "keyData": {
    "id": "uuid",
    "name": "string",
    "createdAt": "timestamp",
    "isActive": true,
    "requestsPerMinute": 60,
    "requestsPerDay": 10000
  }
}
```

### GET /api/admin/api-keys

Список всех ключей.

**Response:**
```json
{
  "success": true,
  "keys": [
    {
      "id": "uuid",
      "name": "string",
      "createdAt": "timestamp",
      "lastUsedAt": "timestamp",
      "isActive": true,
      "requestsPerMinute": 60,
      "requestsPerDay": 10000
    }
  ]
}
```

### PATCH /api/admin/api-keys/:id

Обновление лимитов или статуса.

**Request:**
```json
{
  "requestsPerMinute": 120,
  "requestsPerDay": 50000,
  "isActive": true
}
```

### DELETE /api/admin/api-keys/:id

Отзыв ключа (устанавливает `is_active = false`).

---

> См. также: [AUTHENTICATION.md](./AUTHENTICATION.md), [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md), [PERFORMANCE.md](./PERFORMANCE.md)
