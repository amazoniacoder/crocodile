# Admin Private Channels System — План реализации

> Версия: 1.0  
> Дата создания: Январь 2025  
> Статус: ✅ Реализовано

---

## Обзор

Система приватных каналов для админа позволяет создавать Telegram и YouTube каналы, видимые только администратору в его личной ленте `/my`. Обычные пользователи не видят эти каналы в публичных списках `/social` и `/youtube`.

---

## Архитектурное решение

### Вариант 1 (отклонён): Флаг `isAdminOnly`
- Простое решение с одним полем в `news_sources`
- Не масштабируется для нескольких админов

### Вариант 2 (реализован): Таблица связей `admin_channel_access`
- Гибкая система доступа через связующую таблицу
- Поддержка нескольких админов с разными наборами приватных каналов
- Масштабируемость для будущих расширений

---

## Реализация

### Этап 1: Миграция БД

**Файл:** `drizzle/0032_admin_private_channels.sql`

**Изменения:**
1. Включение расширения `pgcrypto` для генерации токенов
2. Добавление поля `is_admin BOOLEAN` в таблицу `user_tokens`
3. Добавление поля `is_private BOOLEAN` в таблицу `news_sources`
4. Создание таблицы `admin_channel_access`:
   ```sql
   CREATE TABLE admin_channel_access (
     id SERIAL PRIMARY KEY,
     token_id INTEGER NOT NULL REFERENCES user_tokens(id) ON DELETE CASCADE,
     source_id INTEGER NOT NULL REFERENCES news_sources(id) ON DELETE CASCADE,
     created_at TIMESTAMP DEFAULT NOW() NOT NULL,
     UNIQUE(token_id, source_id)
   );
   ```
5. Автоматическое создание бесрочного админского токена
6. Индексы для оптимизации запросов

**Результат:**
- Админский токен формата `ut_<64 hex chars>`
- Бесрочный (expires_at = NULL)
- Флаг `is_admin = true`

---

### Этап 2-4: Обновление TypeScript схем и domain-типов

**Файлы:**
- `shared/types/schema.ts` — добавлены поля и таблица
- `server/domain/news/NewsSource.ts` — добавлено `isPrivate?: boolean`
- `server/domain/user/UserToken.ts` — добавлено `isAdmin?: boolean`
- `server/infrastructure/persistence/NewsSourceRepository.ts` — маппинг `isPrivate`
- `server/infrastructure/persistence/UserTokenRepository.ts` — маппинг `isAdmin`, метод `findAdminToken()`

---

### Этап 5: Создание AdminChannelAccessRepository

**Файл:** `server/infrastructure/persistence/AdminChannelAccessRepository.ts`

**Методы:**
- `getAccessibleSourceIds(tokenId)` — ID источников, доступных админу
- `grantAccess(tokenId, sourceId)` — предоставить доступ
- `revokeAccess(tokenId, sourceId)` — отозвать доступ
- `getAdminsWithAccess(sourceId)` — список админов с доступом к каналу
- `revokeAllAccess(sourceId)` — удалить все доступы (при удалении канала)
- `hasAccess(tokenId, sourceId)` — проверка доступа
- `getAccessiblePrivateChannels(tokenId)` — приватные каналы с полной информацией

---

### Этап 6-7: Обновление аутентификации

**Файлы:**
- `server/infrastructure/auth/UserTokenService.ts`
  - `ValidationResult` теперь включает `isAdmin?: boolean`
  - Кэширование флага `isAdmin` в Redis

- `server/middleware/userTokenAuth.ts`
  - Расширение `Express.Request` с полем `isAdmin?: boolean`
  - Middleware `authenticateUserToken` устанавливает `req.isAdmin`

**Результат:**
- Любой роут с `authenticateUserToken` имеет доступ к `req.isAdmin`
- Проверка: `if (req.isAdmin) { /* админская логика */ }`

---

### Этап 8: Admin API для управления приватными каналами

**Файл:** `server/api/admin/admin-channels/index.ts`

**Эндпоинты:**

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/admin/admin-channels/token` | Получить админский токен |
| GET | `/api/admin/admin-channels/sources` | Список приватных каналов |
| POST | `/api/admin/admin-channels/sources` | Создать приватный канал |
| DELETE | `/api/admin/admin-channels/sources/:id` | Удалить приватный канал |

**Логика создания приватного канала:**
1. Создать источник через `newsSourceRepository.insert()`
2. Обновить `isPrivate = true`, `username` или `channelId`
3. Получить админский токен через `findAdminToken()`
4. Предоставить доступ через `grantAccess(adminToken.id, source.id)`
5. Записать в аудит-лог

**Аудит:**
- Все действия логируются через `auditLogger.log()`
- Ресурс: `admin_private_channel`
- Действия: `CREATE`, `DELETE`

---

### Этап 9: Обновление API `/api/my/available-channels`

**Файл:** `server/api/my/index.ts`

**Логика:**
```typescript
if (isAdmin) {
  // Админ видит все публичные + свои приватные
  const privateSourceIds = await adminChannelAccessRepository.getAccessibleSourceIds(tokenId);
  channels = sources.filter(s => 
    s.isActive && 
    (!s.isPrivate || privateSourceIds.includes(s.id))
  );
} else {
  // Обычный пользователь видит только публичные
  channels = sources.filter(s => s.isActive && !s.isPrivate);
}
```

**Результат:**
- Приватные каналы отмечены флагом `isPrivate: true`
- Отображаются в панели подписок с бейджем 🔒

---

### Этап 10-13: Frontend — Zone O в админке

**Файлы:**
- `client/src/components/admin/ZoneO.tsx` — компонент управления
- `client/src/components/admin/ZoneO.css` — стили
- `client/src/pages/admin-monitor.tsx` — подключение Zone O
- `client/src/components/admin/monitor/MonitorLayout.tsx` — навигация

**Функциональность Zone O:**

#### Секция 1: Админский токен
- Отображение бесрочного токена
- Кнопки "Показать/Скрыть" и "Копировать"
- Метаданные: дата создания, последнее использование
- Подсказка: "Используйте этот токен для доступа к приватным каналам на странице /my"

#### Секция 2: Приватные каналы
- Список приватных каналов с иконками (📱 Telegram, 📺 YouTube)
- Форма добавления канала:
  - Тип канала (Telegram/YouTube)
  - Название
  - URL канала
  - RSS URL
  - Username (для Telegram) или Channel ID (для YouTube)
- Кнопка "Удалить" для каждого канала
- Бейдж "🔒 Приватный"

**Стили:**
- Адаптивный дизайн (mobile-first)
- Карточки с hover-эффектами
- Форма с валидацией
- Кнопка "Удалить" красного цвета

---

## Использование

### Для администратора

1. **Получить админский токен:**
   - Открыть `/admin/monitor`
   - Перейти в Zone O
   - Скопировать токен

2. **Создать приватный канал:**
   - В Zone O нажать "+ Добавить канал"
   - Заполнить форму:
     - Telegram: `https://t.me/channel`, username без @
     - YouTube: `https://youtube.com/@channel`, Channel ID
   - Нажать "Создать приватный канал"

3. **Использовать приватные каналы:**
   - Открыть `/my`
   - Вставить админский токен
   - В панели подписок увидеть приватные каналы с бейджем 🔒
   - Подписаться на приватные каналы
   - Просматривать посты в личной ленте

4. **Удалить приватный канал:**
   - В Zone O нажать "Удалить" у канала
   - Подтвердить удаление

### Для обычных пользователей

- Приватные каналы **не видны** в `/social` и `/youtube`
- Приватные каналы **не видны** в `/api/my/available-channels` (без админского токена)
- Обычные пользователи не могут подписаться на приватные каналы

---

## Безопасность

### Аутентификация
- Админский токен проверяется через `UserTokenService.validateToken()`
- Кэширование в Redis (TTL 5 минут)
- Флаг `isAdmin` передаётся через middleware

### Авторизация
- Все эндпоинты `/api/admin/admin-channels/*` защищены `authenticateAdmin`
- Проверка `isPrivate` перед удалением канала
- Только админ может создавать/удалять приватные каналы

### Аудит
- Все действия логируются в `admin_audit_log`
- Записываются: action, resource, oldValue, newValue, IP, User-Agent
- Хранение 6 месяцев

### Изоляция данных
- Приватные каналы фильтруются на уровне API
- Обычные пользователи не могут получить доступ через прямые запросы
- Каскадное удаление: при удалении канала удаляются все связи в `admin_channel_access`

---

## Масштабирование

### Поддержка нескольких админов

**Текущая реализация:**
- Один бесрочный админский токен
- Все приватные каналы доступны этому токену

**Будущее расширение:**
1. Создать несколько админских токенов:
   ```sql
   INSERT INTO user_tokens (token, label, is_admin, expires_at)
   VALUES ('ut_...', 'Admin 2', true, NULL);
   ```

2. Предоставить доступ к конкретным каналам:
   ```typescript
   await adminChannelAccessRepository.grantAccess(admin2TokenId, channelId);
   ```

3. Каждый админ видит только свои приватные каналы

### Групповые каналы

**Возможное расширение:**
- Добавить таблицу `admin_groups`
- Связать группы с каналами через `admin_group_channels`
- Админы входят в группы через `admin_group_members`
- Админ видит каналы своих групп

---

## Метрики и мониторинг

### Метрики в Zone O
- Количество приватных каналов
- Дата создания админского токена
- Последнее использование токена

### Аудит-лог
- Все действия с приватными каналами
- Фильтрация по ресурсу `admin_private_channel`
- Просмотр в Zone I (Token Management)

### База данных
```sql
-- Количество приватных каналов
SELECT COUNT(*) FROM news_sources WHERE is_private = true;

-- Админы с доступом к каналу
SELECT token_id FROM admin_channel_access WHERE source_id = ?;

-- Каналы, доступные админу
SELECT source_id FROM admin_channel_access WHERE token_id = ?;
```

---

## Тестирование

### Unit-тесты (TODO)
- `AdminChannelAccessRepository.spec.ts`
  - `grantAccess()` создаёт запись
  - `revokeAccess()` удаляет запись
  - `getAccessibleSourceIds()` возвращает корректный список
  - `hasAccess()` проверяет доступ

### Integration-тесты (TODO)
- `admin-channels.test.ts`
  - POST `/api/admin/admin-channels/sources` создаёт приватный канал
  - GET `/api/admin/admin-channels/sources` возвращает список
  - DELETE удаляет канал и связи
  - Обычный пользователь не видит приватные каналы в `/api/my/available-channels`
  - Админ видит приватные каналы в `/api/my/available-channels`

### E2E-тесты (TODO)
- Создание приватного канала через Zone O
- Копирование админского токена
- Подписка на приватный канал в `/my`
- Просмотр постов приватного канала

---

## Известные ограничения

1. **Один админский токен:**
   - Текущая реализация поддерживает только один бесрочный токен
   - Для нескольких админов нужно создавать токены вручную через SQL

2. **Нет UI для управления доступом:**
   - Нельзя предоставить доступ к каналу другому админу через UI
   - Требуется прямой SQL-запрос

3. **Нет групп каналов:**
   - Нельзя создать группу приватных каналов
   - Каждый канал управляется отдельно

4. **Нет истории изменений:**
   - Аудит-лог показывает только CREATE/DELETE
   - Нет истории изменений метаданных канала (название, URL)

---

## Roadmap

### v1.1 (Текущая версия)
- ✅ Создание приватных каналов
- ✅ Админский токен
- ✅ Zone O в админке
- ✅ Фильтрация в `/api/my/available-channels`

### v1.2 (Планируется)
- [ ] UI для управления несколькими админами
- [ ] Предоставление доступа к каналу другому админу
- [ ] История изменений канала
- [ ] Статистика использования приватных каналов

### v2.0 (Будущее)
- [ ] Групповые каналы
- [ ] Роли и права доступа (read-only, admin)
- [ ] Временный доступ к приватным каналам
- [ ] Экспорт/импорт конфигурации приватных каналов

---

## Связанные документы

- [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) — описание таблиц
- [ARCHITECTURE.md](./ARCHITECTURE.md) — общая архитектура
- [AUTHENTICATION.md](./AUTHENTICATION.md) — система аутентификации
- [MONITOR_GUIDE.md](./MONITOR_GUIDE.md) — кабинет мониторинга

---

## Changelog

### 2025-01-XX — v1.0
- Первая версия системы админских приватных каналов
- Миграция 0032
- Zone O в админке
- API `/api/admin/admin-channels`
- Обновление `/api/my/available-channels`

---

*Система готова к использованию в production.*
