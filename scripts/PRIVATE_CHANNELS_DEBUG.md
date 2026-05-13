# Диагностика приватных каналов

## Проблема
Приватные каналы не отображаются в Zone O, в фильтрах /my и в статистике.

## Что исправлено

1. **NewsSourceRepository.update** — добавлены типы для `isPrivate`, `username`, `channelId`
2. **Логирование** — добавлены console.log для отладки в:
   - `/api/admin/admin-channels/sources` (Zone O)
   - `/api/my/available-channels` (фильтры)

## Как проверить

### 1. Проверка через браузер

1. Откройте DevTools (F12) → Console
2. Перейдите в Zone O админки
3. Смотрите логи:
   ```
   [Zone O] Total sources: X
   [Zone O] Source ID (Name): isPrivate=true/false, type=boolean
   [Zone O] Private sources: Y
   ```

4. Перейдите на `/my` с админским токеном
5. Откройте панель фильтров
6. Смотрите логи:
   ```
   [Available Channels] TokenId: X, IsAdmin: true
   [Available Channels] Total sources: Y
   [Available Channels] Admin private source IDs: [...]
   [Available Channels] Admin channels: Z, Private: N
   ```

### 2. Проверка через SQL (если есть доступ к БД)

Выполните скрипт `scripts/check-private-channels.sql`:

```sql
-- Все приватные каналы
SELECT id, name, source_type, is_private, is_active, username, channel_id
FROM news_sources 
WHERE is_private = true;

-- Связи админ-токен → приватные каналы
SELECT aca.token_id, aca.source_id, ns.name, ns.source_type
FROM admin_channel_access aca
JOIN news_sources ns ON aca.source_id = ns.id;
```

### 3. Проверка через API

Используйте скрипт `scripts/test-private-channels.js`:

```bash
ADMIN_TOKEN=your-token node scripts/test-private-channels.js
```

## Возможные причины отсутствия каналов

### 1. Каналы не созданы
- Проверьте: `SELECT COUNT(*) FROM news_sources WHERE is_private = true;`
- Решение: создайте каналы через Zone O или выполните SQL-скрипт

### 2. Поле `is_private` = NULL или false
- Проверьте логи: `isPrivate=null` или `isPrivate=false`
- Решение: обновите через Zone O (редактирование) или SQL:
  ```sql
  UPDATE news_sources SET is_private = true WHERE id = X;
  ```

### 3. Нет связи в `admin_channel_access`
- Проверьте: `SELECT * FROM admin_channel_access WHERE source_id = X;`
- Решение: добавьте связь:
  ```sql
  INSERT INTO admin_channel_access (token_id, source_id)
  SELECT id, X FROM user_tokens WHERE is_admin = true;
  ```

### 4. Админский токен не найден
- Проверьте: `SELECT * FROM user_tokens WHERE is_admin = true;`
- Решение: выполните миграцию `0032_admin_private_channels.sql`

### 5. Токен не распознаётся как админский
- Проверьте логи: `IsAdmin: false`
- Решение: проверьте middleware `authenticateUserToken` — должен устанавливать `req.isAdmin = true`

## Следующие шаги

1. Запустите сервер в dev-режиме: `npm run dev`
2. Откройте Zone O и проверьте логи в консоли браузера
3. Если каналов нет — создайте тестовый канал через форму
4. Проверьте, появился ли он в списке
5. Проверьте, появился ли он в фильтрах `/my`
6. Проверьте статистику на вкладке "Статистика"

## Контакты для отладки

Если проблема не решена, предоставьте:
- Логи из консоли браузера (Zone O)
- Логи из консоли браузера (/my)
- Логи сервера (терминал)
- Результат SQL-запросов из `check-private-channels.sql`
