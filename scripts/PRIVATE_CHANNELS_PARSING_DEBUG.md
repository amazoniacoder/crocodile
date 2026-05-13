# Проверка парсинга приватных каналов

## Проблема
Приватные YouTube/Telegram каналы не парсятся — нет статей в БД.

## Что добавлено для диагностики

### Логирование в коде:
1. `NewsSourceRepository.findAllActive()` — выводит количество активных источников по типам
2. `CollectNewsUseCase.getSourcesToProcess()` — выводит фильтрацию по группам
3. `CollectNewsUseCase.processSource()` — выводит обработку каждого источника

## Как проверить

### 1. Запустите сервер и смотрите логи

```bash
npm run dev
```

### 2. Нажмите "Ручной сбор RSS" в Zone O

Смотрите логи в терминале:

```
[NewsSourceRepository] Active sources: 50 (private: 20, youtube: 15, telegram: 10)
[CollectNewsUseCase] Group: all, All sources: 50
[CollectNewsUseCase] Filtered sources for all: 50
[CollectNewsUseCase] Processing source: Ivans Bobrovs 2 (youtube, private: true)
📰 Collected 5 new articles
```

### 3. Проверьте, обрабатываются ли приватные каналы

Ищите в логах строки с `private: true`:

```
[CollectNewsUseCase] Processing source: Ivans Bobrovs 2 (youtube, private: true)
```

Если таких строк нет — приватные каналы не попадают в сбор.

### 4. Проверьте статьи в БД

```sql
-- Статьи из приватных источников
SELECT 
  ns.name,
  ns.source_type,
  ns.is_private,
  COUNT(na.id) as articles_count,
  MAX(na.published_at) as latest_article
FROM news_sources ns
LEFT JOIN news_articles na ON ns.id = na.source_id
WHERE ns.is_private = true
GROUP BY ns.id, ns.name, ns.source_type, ns.is_private
ORDER BY articles_count DESC;
```

### 5. Проверьте RSS URL приватных каналов

```sql
SELECT id, name, rss_url, is_active, is_private
FROM news_sources
WHERE is_private = true;
```

Убедитесь, что:
- `is_active = true`
- `rss_url` корректный (для YouTube: `https://www.youtube.com/feeds/videos.xml?channel_id=UC...`)

## Возможные причины отсутствия статей

### 1. Каналы неактивны
```sql
UPDATE news_sources SET is_active = true WHERE is_private = true;
```

### 2. Некорректный RSS URL
Для YouTube должен быть формат:
```
https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxxxxxxxxxxxxxxxxxx
```

Проверьте Channel ID (24 символа, начинается с `UC`).

### 3. Каналы пустые (нет видео)
Проверьте вручную:
```bash
curl "https://www.youtube.com/feeds/videos.xml?channel_id=UC..."
```

Если RSS пустой — канал не публиковал видео или Channel ID неверный.

### 4. Rate limiting
Смотрите логи на наличие:
```
Rate limited: ...
```

Если есть — подождите или сбросьте rate limit:
```bash
node scripts/fix-redis-keys.js
```

### 5. Ошибки парсинга
Смотрите логи на наличие:
```
Failed to fetch [channel name]: ...
```

Типичные ошибки:
- `404` — Channel ID неверный
- `Timeout` — медленный ответ
- `Invalid XML` — некорректный формат RSS

## Ручная проверка конкретного канала

### 1. Получите RSS URL из БД
```sql
SELECT id, name, rss_url FROM news_sources WHERE name = 'Ivans Bobrovs 2';
```

### 2. Проверьте RSS вручную
```bash
curl "https://www.youtube.com/feeds/videos.xml?channel_id=UC190PvMt3RK7VPLOhgltEwg"
```

Должен вернуться XML с `<entry>` элементами (видео).

### 3. Запустите сбор только для YouTube
```bash
curl -X POST http://localhost:5000/api/admin/jobs/rss-collect \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"group": "youtube"}'
```

### 4. Проверьте статьи
```sql
SELECT * FROM news_articles 
WHERE source_id = (SELECT id FROM news_sources WHERE name = 'Ivans Bobrovs 2')
ORDER BY published_at DESC
LIMIT 10;
```

## Если статьи всё равно не появляются

1. Проверьте логи сервера на ошибки
2. Убедитесь, что `is_active = true` и `is_private = true`
3. Проверьте, что RSS URL корректный
4. Проверьте, что Channel ID правильный (24 символа, начинается с `UC`)
5. Проверьте, что канал публиковал видео (RSS не пустой)
6. Проверьте rate limiting в Redis
7. Запустите ручной сбор и смотрите логи

## Контакты для отладки

Предоставьте:
- Логи сервера при ручном сборе
- Результат SQL-запроса проверки приватных источников
- Результат `curl` проверки RSS URL
- Скриншот Zone O с приватными каналами
