# Authentication Guide

> Версия: 1.0  
> Создан: Май 2025

---

## Обзор

Система аутентификации для административного API. Поддерживает два механизма:
1. **TokenManager** — токены в БД с TTL и ротацией (рекомендуется)
2. **Legacy ADMIN_TOKEN** — токен из `.env` (для обратной совместимости)

**Единый middleware:** `authenticateAdmin` (`server/middleware/security.ts`)

---

## Архитектура

```
┌─────────────────────────────────────────┐
│         Admin Request                   │
│  Authorization: Bearer <token>          │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│      authenticateAdmin Middleware       │
│  1. Проверка через TokenManager         │
│  2. Fallback на ADMIN_TOKEN из .env     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│         TokenManager                    │
│  • Валидация токена                     │
│  • Проверка TTL                         │
│  • Обновление last_used_at              │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│    PostgreSQL: admin_tokens             │
│  • token_hash (bcrypt)                  │
│  • expires_at                           │
│  • is_active                            │
└─────────────────────────────────────────┘
```

---

## TokenManager (рекомендуется)

### Таблица admin_tokens

```sql
CREATE TABLE admin_tokens (
  id UUID PRIMARY KEY,
  token_hash VARCHAR(255) NOT NULL,      -- bcrypt хэш
  name VARCHAR(100) NOT NULL,            -- Название токена
  expires_at TIMESTAMP NOT NULL,         -- Время истечения
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL,
  last_used_at TIMESTAMP
);

CREATE INDEX idx_admin_tokens_hash ON admin_tokens(token_hash);
CREATE INDEX idx_admin_tokens_active ON admin_tokens(is_active, expires_at);
```

### Создание токена

```bash
curl -X POST http://localhost:5000/api/admin/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CI/CD Pipeline",
    "expiresInSeconds": 2592000
  }'
```

**Параметры:**
- `name` — название токена (для идентификации)
- `expiresInSeconds` — время жизни в секундах (default: 30 дней)

**Ответ:**
```json
{
  "success": true,
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2",
  "tokenData": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "CI/CD Pipeline",
    "expiresAt": "2025-06-14T10:30:00.000Z",
    "isActive": true,
    "createdAt": "2025-05-15T10:30:00.000Z"
  }
}
```

**⚠️ ВАЖНО:** Токен показывается **только один раз**. Сохраните его в безопасном месте.

### Формат токена

```
<64 hex characters>
```

**Пример:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

**Генерация:**
```typescript
const token = crypto.randomBytes(32).toString('hex');
// 32 bytes = 64 hex characters
```

**Хранение:**
```typescript
const tokenHash = await bcrypt.hash(token, 10);
// Сохраняется только bcrypt-хэш
```

### Использование токена

```bash
curl http://localhost:5000/api/admin/news/sources \
  -H "Authorization: Bearer a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
```

### Список токенов

```bash
curl http://localhost:5000/api/admin/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Ответ:**
```json
{
  "success": true,
  "tokens": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "CI/CD Pipeline",
      "expiresAt": "2025-06-14T10:30:00.000Z",
      "isActive": true,
      "createdAt": "2025-05-15T10:30:00.000Z",
      "lastUsedAt": "2025-05-15T12:45:00.000Z"
    }
  ]
}
```

### Отзыв токена

```bash
curl -X DELETE http://localhost:5000/api/admin/tokens/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Эффект:**
- `is_active` устанавливается в `false`
- Токен перестаёт работать немедленно

### Ротация токена

```bash
curl -X POST http://localhost:5000/api/admin/tokens/550e8400-e29b-41d4-a716-446655440000/rotate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "gracePeriodSeconds": 3600
  }'
```

**Параметры:**
- `gracePeriodSeconds` — период, в течение которого оба токена (старый и новый) валидны (default: 3600 = 1 час)

**Ответ:**
```json
{
  "success": true,
  "token": "new_token_64_hex_chars",
  "tokenData": {
    "id": "new_uuid",
    "name": "CI/CD Pipeline",
    "expiresAt": "2025-06-14T10:30:00.000Z",
    "isActive": true,
    "createdAt": "2025-05-15T13:00:00.000Z"
  }
}
```

**Процесс ротации:**
1. Создаётся новый токен
2. Старый токен остаётся активным на `gracePeriodSeconds`
3. Обновите приложение с новым токеном
4. Через `gracePeriodSeconds` старый токен автоматически отзывается

---

## Legacy ADMIN_TOKEN (устаревший)

### Настройка

```env
# .env
ADMIN_TOKEN=<сгенерировать: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

**Генерация:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Вывод: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Использование

```bash
curl http://localhost:5000/api/admin/news/sources \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Недостатки

- Нет TTL (токен вечный)
- Нет ротации (нужен перезапуск для смены)
- Нет аудита (не видно, кто использовал)
- Нет множественных токенов (один токен для всех)

**Рекомендация:** мигрировать на TokenManager.

---

## Миграция с Legacy на TokenManager

### Шаг 1: Создать токены через TokenManager

```bash
# Токен для CI/CD
CI_TOKEN=$(curl -X POST http://localhost:5000/api/admin/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "CI/CD", "expiresInSeconds": 7776000}' \
  | jq -r '.token')

# Токен для мониторинга
MONITOR_TOKEN=$(curl -X POST http://localhost:5000/api/admin/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Monitoring", "expiresInSeconds": 7776000}' \
  | jq -r '.token')
```

### Шаг 2: Обновить приложения с новыми токенами

```bash
# CI/CD
export ADMIN_TOKEN=$CI_TOKEN

# Monitoring
export ADMIN_TOKEN=$MONITOR_TOKEN
```

### Шаг 3: Удалить ADMIN_TOKEN из .env

```env
# .env
# ADMIN_TOKEN=<старый токен> — удалить эту строку
```

### Шаг 4: Перезапустить сервер

```bash
npm run start
```

**Проверка:**
```bash
# Старый токен не работает
curl http://localhost:5000/api/admin/news/sources \
  -H "Authorization: Bearer <старый токен>"
# Ожидается: 401 Unauthorized

# Новый токен работает
curl http://localhost:5000/api/admin/news/sources \
  -H "Authorization: Bearer $CI_TOKEN"
# Ожидается: 200 OK
```

---

## Middleware authenticateAdmin

### Код

```typescript
// server/middleware/security.ts
export async function authenticateAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  
  const token = authHeader.substring(7);
  
  // 1. Проверка через TokenManager
  const tokenData = await tokenManager.validateToken(token);
  if (tokenData) {
    req.adminToken = tokenData;
    return next();
  }
  
  // 2. Fallback на legacy ADMIN_TOKEN
  if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) {
    req.adminToken = { name: 'legacy', id: 'legacy' };
    return next();
  }
  
  return res.status(401).json({ error: 'Invalid or expired token' });
}
```

### Использование

```typescript
// server/api/admin/news/index.ts
import { authenticateAdmin } from '../../../middleware/security';

router.get('/sources', authenticateAdmin, async (req, res) => {
  // req.adminToken доступен
  const sources = await newsSourceRepository.findAll();
  res.json({ success: true, sources });
});
```

---

## Аудит

### Логирование действий

```typescript
// server/infrastructure/audit/AuditLogger.ts
await auditLogger.log({
  adminToken: req.adminToken.id,
  action: 'CREATE',
  resource: 'news_source',
  resourceId: source.id,
  oldValue: null,
  newValue: source,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  success: true
});
```

### Просмотр аудита

```bash
curl "http://localhost:5000/api/admin/audit/logs?limit=50" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Ответ:**
```json
{
  "success": true,
  "logs": [
    {
      "id": "uuid",
      "adminToken": "550e8400-e29b-41d4-a716-446655440000",
      "action": "CREATE",
      "resource": "news_source",
      "resourceId": "123",
      "oldValue": null,
      "newValue": {"name": "Test Source", ...},
      "ipAddress": "127.0.0.1",
      "userAgent": "curl/7.68.0",
      "success": true,
      "timestamp": "2025-05-15T12:45:00.000Z"
    }
  ]
}
```

---

## Безопасность

### Хранение токена

**❌ Не делайте:**
```typescript
// Хранение токена в открытом виде
await db.insert(adminTokens).values({ token: 'a1b2c3...' });
```

**✅ Делайте:**
```typescript
// Хранение только bcrypt-хэша
const tokenHash = await bcrypt.hash(token, 10);
await db.insert(adminTokens).values({ tokenHash });
```

### Передача токена

**❌ Не делайте:**
```bash
# Query параметр попадает в логи
curl "http://example.com/api/admin/sources?token=a1b2c3..."
```

**✅ Делайте:**
```bash
# Заголовок Authorization
curl http://example.com/api/admin/sources \
  -H "Authorization: Bearer a1b2c3..."
```

### TTL токенов

**Рекомендации:**
- **CI/CD:** 90 дней (автоматическая ротация)
- **Мониторинг:** 90 дней
- **Разработка:** 7 дней
- **Временный доступ:** 1 день

### Ротация токенов

**Автоматическая ротация (CI/CD):**
```bash
#!/bin/bash
# rotate-token.sh

OLD_TOKEN=$ADMIN_TOKEN

# Ротация с grace period 1 час
NEW_TOKEN=$(curl -X POST http://localhost:5000/api/admin/tokens/$TOKEN_ID/rotate \
  -H "Authorization: Bearer $OLD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"gracePeriodSeconds": 3600}' \
  | jq -r '.token')

# Обновить переменную окружения
export ADMIN_TOKEN=$NEW_TOKEN

# Обновить секрет в CI/CD
# (зависит от платформы: GitHub Actions, GitLab CI, etc.)
```

**Cron:** каждые 60 дней.

---

## Troubleshooting

### Токен не работает

**Проверка:**
```bash
curl http://localhost:5000/api/admin/news/sources \
  -H "Authorization: Bearer <token>" \
  -v
```

**Возможные причины:**
1. Токен истёк (`expires_at < NOW()`)
2. Токен отозван (`is_active = false`)
3. Неправильный формат заголовка (должен быть `Bearer <token>`)
4. Опечатка в токене

**Решение:**
```bash
# Проверить статус токена
curl http://localhost:5000/api/admin/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.tokens[] | select(.name == "My Token")'
```

### 401 Unauthorized

**Симптомы:**
```json
{
  "error": "Invalid or expired token"
}
```

**Решение:**
1. Проверить формат заголовка: `Authorization: Bearer <token>`
2. Проверить, что токен не истёк
3. Создать новый токен

### Медленная валидация

**Симптомы:**
- Запросы к admin API медленнее обычного

**Причина:**
- bcrypt.compare медленный (намеренно, для безопасности)

**Решение:**
- Нормально, bcrypt должен быть медленным (~100ms)
- Если критично — кэшировать результат валидации (не рекомендуется)

---

## API Reference

### POST /api/admin/tokens

Создание нового токена.

**Request:**
```json
{
  "name": "string",
  "expiresInSeconds": 2592000
}
```

**Response:**
```json
{
  "success": true,
  "token": "string",
  "tokenData": {
    "id": "uuid",
    "name": "string",
    "expiresAt": "timestamp",
    "isActive": true,
    "createdAt": "timestamp"
  }
}
```

### GET /api/admin/tokens

Список всех токенов.

**Response:**
```json
{
  "success": true,
  "tokens": [
    {
      "id": "uuid",
      "name": "string",
      "expiresAt": "timestamp",
      "isActive": true,
      "createdAt": "timestamp",
      "lastUsedAt": "timestamp"
    }
  ]
}
```

### POST /api/admin/tokens/:id/rotate

Ротация токена с grace period.

**Request:**
```json
{
  "gracePeriodSeconds": 3600
}
```

**Response:**
```json
{
  "success": true,
  "token": "string",
  "tokenData": {
    "id": "uuid",
    "name": "string",
    "expiresAt": "timestamp",
    "isActive": true,
    "createdAt": "timestamp"
  }
}
```

### DELETE /api/admin/tokens/:id

Отзыв токена.

**Response:**
```json
{
  "success": true,
  "message": "Token revoked successfully"
}
```

---
---`n
> См. также: [API_KEYS_GUIDE.md](./API_KEYS_GUIDE.md), [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md), [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
