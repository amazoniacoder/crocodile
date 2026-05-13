# YouTube Integration Guide

> Руководство по работе с YouTube-каналами в Crocodile
> Версия: 1.0 | Дата: Май 2025

---

## Содержание

1. [Обзор](#обзор)
2. [Как добавить канал](#как-добавить-канал)
3. [Архитектура](#архитектура)
4. [API Reference](#api-reference)
5. [Troubleshooting](#troubleshooting)

---

## Обзор

YouTube-каналы интегрированы через официальные RSS-фиды (`youtube.com/feeds/videos.xml`). Видео собираются как обычные статьи с `sourceType = 'youtube'` и отображаются на странице `/youtube`. Плеер встраивается прямо в карточку через iframe без дополнительных зависимостей.

**Ключевые особенности:**
- Официальный RSS — без парсинга страниц, без нарушения ToS
- Нулевая нагрузка на сервер при воспроизведении (iframe на стороне клиента)
- Та же инфраструктура что и для RSS/Telegram — `RssParser`, `CollectNewsUseCase`, `news_articles`
- Thumbnail автоматически из `i.ytimg.com/vi/{videoId}/hqdefault.jpg`
- Переключение Telegram ↔ YouTube кнопками в навбаре

---

## Как добавить канал

### Шаг 1 — Найти Channel ID

Channel ID — это строка вида `UCHnyfMqiRRG1u-2MsSQLbXA`. Это **не** `@username`.

**Способ 1 — через страницу канала:**
1. Открыть страницу канала на YouTube
2. Нажать правой кнопкой → «Просмотр кода страницы»
3. Найти `"channelId":"UC..."`

**Способ 2 — через URL:**
- Если URL вида `youtube.com/channel/UCxxxxxxx` — ID прямо в URL
- Если URL вида `youtube.com/@username` — нужен способ 1

**Способ 3 — онлайн-сервисы:**
- [commentpicker.com/youtube-channel-id.php](https://commentpicker.com/youtube-channel-id.php) — вставить URL канала, получить ID

### Шаг 2 — Сформировать RSS URL

```
https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
```

**Примеры:**
```
https://www.youtube.com/feeds/videos.xml?channel_id=UCHnyfMqiRRG1u-2MsSQLbXA
https://www.youtube.com/feeds/videos.xml?channel_id=UC295-Dw0tDd-hoVEjEmBcnA
```

**Проверка RSS перед добавлением:**
```bash
curl "https://www.youtube.com/feeds/videos.xml?channel_id=UCHnyfMqiRRG1u-2MsSQLbXA"
# Должен вернуть XML с тегами <entry> и <yt:videoId>
```

### Шаг 3 — Добавить через кабинет мониторинга

1. Открыть `/admin/monitor` → Zone C (Control Room)
2. Вкладка «Источники» → «Добавить источник»
3. Заполнить форму:

| Поле | Значение | Пример |
|------|----------|--------|
| Название | Отображаемое имя канала | `Veritasium` |
| URL сайта | Страница канала на YouTube | `https://www.youtube.com/@veritasium` |
| RSS URL | Фид с channel_id | `https://www.youtube.com/feeds/videos.xml?channel_id=UCHnyfMqiRRG1u-2MsSQLbXA` |
| Тип источника | `youtube` | |
| Регион | `russia` или `world` | `world` |
| Категория | Тематика канала | `tech` |

### Шаг 4 — Запустить сбор

```bash
curl -X POST http://localhost:5000/api/admin/jobs/rss-collect \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"group": "all"}'
```

Или через Zone C → «Запустить сбор вручную».

### Шаг 5 — Проверить результат

```sql
SELECT title, video_id, image_url, published_at
FROM news_articles
WHERE source_type = 'youtube'
ORDER BY published_at DESC
LIMIT 10;
```

---

## Витринный канал (бесплатный доступ)

Один канал можно сделать полностью бесплатным — он будет виден без токена подписки.

Установить флаг через SQL:
```sql
UPDATE news_sources SET is_featured = true WHERE id = <ID_КАНАЛА>;
```

Или через API:
```bash
curl -X PATCH http://localhost:5000/api/admin/news/sources/<ID> \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isFeatured": true}'
```

Рекомендуется выбрать канал с высокой активностью и разнообразным контентом.

---

## Популярные каналы для старта

| Канал | Channel ID | Категория | Регион |
|-------|-----------|-----------|--------|
| Veritasium | `UCHnyfMqiRRG1u-2MsSQLbXA` | tech | world |
| Kurzgesagt | `UCsXVk37bltHxD1rDPwtNM8Q` | tech | world |
| РБК | `UC295-Dw0tDd-hoVEjEmBcnA` | economy | russia |
| Редакция | `UCwqPCCnBMSFOzBfMnFBBGkA` | politics | russia |
| Наука и жизнь | `UCVgO39Bk5sMo66-6o6Spn6Q` | other | russia |

---

## Архитектура

### Поток данных

```
YouTube RSS Feed
  ↓
RssParser (парсит yt:videoId, media:thumbnail, media:group)
  ↓
news_articles (sourceType='youtube', videoId='UCxxxx')
  ↓
GET /api/news?sourceType=youtube
  ↓
SocialAggregator → NewsFeed → NewsCard
  ↓
YouTubeEmbed (iframe youtube.com/embed/{videoId})
```

### Файлы

| Файл | Назначение |
|------|-----------|
| `server/infrastructure/rss/RssParser.ts` | Парсинг `yt:videoId`, `media:thumbnail`, `media:group` |
| `server/api/youtube/index.ts` | `/api/youtube/status`, `/channels`, `/channel/:channelId` |
| `client/src/components/news/YouTubeEmbed.tsx` | iframe-плеер |
| `client/src/components/news/YouTubeChannelCard.tsx` | Карточка канала на странице `/youtube/channel/:id` |
| `client/src/pages/youtube/YouTubePage.tsx` | Страница `/youtube` |
| `client/src/pages/youtube/YouTubeChannelPage.tsx` | Страница `/youtube/channel/:channelId` |
| `client/src/components/news/NewsCard.tsx` | Кнопки «Смотреть видео» / «На YouTube» |
| `drizzle/0024_youtube_integration.sql` | Миграция: `video_id`, `is_featured` |

### Схема БД (изменения)

**`news_sources`** — добавлено:
- `source_type = 'youtube'` — новое значение enum
- `is_featured boolean` — витринный канал (бесплатный доступ)

**`news_articles`** — добавлено:
- `video_id varchar(20)` — YouTube video ID для embed

---

## API Reference

### GET /api/youtube/status

Флаг включения страницы (управляется через `source_config.youtube_page_enabled`).

```json
{ "enabled": true }
```

### GET /api/youtube/channels

Список активных YouTube-каналов.

```json
{
  "channels": [
    {
      "id": 42,
      "name": "Veritasium",
      "region": "world",
      "category": "tech",
      "logoUrl": null,
      "isFeatured": true
    }
  ]
}
```

### GET /api/youtube/channel/:channelId

Информация о канале для страницы `/youtube/channel/:channelId`.

```json
{
  "channel": {
    "channelId": "UCHnyfMqiRRG1u-2MsSQLbXA",
    "name": "Veritasium",
    "region": "world",
    "category": "tech",
    "description": null,
    "logoUrl": null,
    "url": "https://www.youtube.com/@veritasium",
    "isFeatured": true
  }
}
```

### GET /api/news?sourceType=youtube

Лента видео. Стандартный эндпоинт с фильтром.

**Параметры:**
- `sourceType=youtube` — обязательный
- `channelId` — фильтр по конкретному каналу
- `page`, `limit` — пагинация

---

## Troubleshooting

### RSS возвращает пустой XML

**Причина:** неверный `channel_id`.

```bash
# Проверить напрямую
curl "https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID"
# Должен быть XML с <feed> и <entry>
```

### videoId не извлекается

**Проверить в БД:**
```sql
SELECT url, video_id FROM news_articles
WHERE source_type = 'youtube' LIMIT 5;
```

Если `video_id = NULL` — проверить что RSS содержит тег `<yt:videoId>`:
```bash
curl "https://www.youtube.com/feeds/videos.xml?channel_id=UC..." | grep "yt:videoId"
```

### Плеер не открывается в карточке

Убедиться что `video_id` заполнен (см. выше). Кнопка «Смотреть видео» появляется только при наличии `videoId`.

### Thumbnail не отображается

YouTube RSS не всегда включает `media:thumbnail` напрямую — он может быть внутри `media:group`. Парсер обрабатывает оба варианта. Если thumbnail всё равно пустой — он генерируется автоматически:
```
https://i.ytimg.com/vi/{videoId}/hqdefault.jpg
```

---

*Последнее обновление: Май 2025*
