# Диаграммы для Эпизода 4: "Frontend: React + TypeScript"

---

## 📊 Диаграмма 1: Дерево провайдеров App.tsx

```
App
└── HelmetProvider (SEO мета-теги)
    └── ThemeProvider (light/dark)
        └── ColorThemeProvider (цветовая схема)
            └── FontSizeProvider (размер шрифта)
                └── NotificationProvider (тосты)
                    └── WebSocketProvider (WS соединение)
                        └── DisplaySettingsProvider (настройки отображения)
                            └── RouteProvider (текущий маршрут)
                                └── AppInner
                                    ├── /admin/monitor → AdminMonitorPage (lazy)
                                    └── /* → Layout
                                              └── Switch (роуты)
```

**Визуальные элементы:**
- Цветовое кодирование по типу провайдера
- Акцент на WebSocketProvider — он оборачивает всё приложение
- Стрелка к lazy AdminMonitorPage

---

## 📊 Диаграмма 2: Жизненный цикл useNewsFeed

```
Маунт компонента
      │
      ├─ IDB preload (если простой запрос)
      │    └─ setArticles(cached) → показываем сразу
      │
      ▼
fetchNews(filters, markNew=false)
      │
      ├─ AbortController.abort() ← отменяем предыдущий запрос
      │
      ├─ fetch('/api/news?...')
      │    ├─ OK → setArticles() + saveFeedSlice(IDB)
      │    └─ Error → loadFeedSlice(IDB) → setIsOffline(true)
      │
      └─ WebSocket lastMessage изменился?
           └─ fetchNews(filters, markNew=true)
                └─ Новые статьи → setPendingArticles()
                                  setUnreadCount(+N)

Пользователь кликает тост "N новых статей"
      │
      └─ acceptPending()
           ├─ setNewIds() → анимация 8 сек
           ├─ setArticles([...pending, ...prev])
           └─ setUnreadCount(0)
              navigator.clearAppBadge()
```

---

## 📊 Диаграмма 3: Виртуализация — до и после

```
БЕЗ виртуализации (500 статей):
┌─────────────────────────────────────────┐
│ DOM: 500 × ~15 узлов = 7,500 узлов     │
│ Высота: 500 × 176px = 88,000px         │
│ Первый рендер: 2-3 сек                 │
│ Скролл: 10-15 fps                      │
│ Память: 200-300 MB                     │
└─────────────────────────────────────────┘

С @tanstack/react-virtual:
┌─────────────────────────────────────────┐
│ Viewport (600px)                        │
│ ┌─────────────────────────────────────┐ │
│ │ overscan (6 карточек выше)          │ │
│ │─────────────────────────────────────│ │
│ │ ВИДИМЫЕ карточки (~4-5)             │ │ ← только они в DOM
│ │─────────────────────────────────────│ │
│ │ overscan (6 карточек ниже)          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Виртуальный контейнер: height=88,000px  │ ← только CSS
│ DOM: ~15 карточек × 15 узлов = 225 узлов│
│ Первый рендер: < 100ms                  │
│ Скролл: 60 fps                          │
└─────────────────────────────────────────┘

Ключевой трюк:
  transform: translateY(${item.start}px)
  ← позиционирование без reflow
```

---

## 📊 Диаграмма 4: Паттерн Pending Articles

```
WebSocket сообщение: "news_updated"
         │
         ▼
fetchNews(filters, markNew=true)
         │
         ▼
Новые статьи (не в prevIdsRef)
         │
         ▼
setPendingArticles([...new, ...prev])
setUnreadCount(+N)
         │
         ▼
Тост: "15 новых статей ↑"    PWA Badge: 15
         │
         │ пользователь кликает
         ▼
acceptPending()
  ├─ setNewIds(Set<id>) → CSS анимация .news-card--new
  ├─ setTimeout(clearNewIds, 8000)
  ├─ setArticles([...pending, ...current])
  └─ setUnreadCount(0) + clearAppBadge()

Staggered анимация карточек:
  card[0]: delay = 0 + 2000 = 2000ms
  card[1]: delay = 200 + 2000 = 2200ms
  card[2]: delay = 400 + 2000 = 2400ms
  ...
  card[8+]: delay = 1600 + 2000 = 3600ms (cap)
```

---

## 📊 Диаграмма 5: NewsCard — три типа

```
NewsCard
    │
    ├─ sourceType === 'rss'
    │    ├─ Заголовок → Link /news/:id-:slug
    │    ├─ Изображение из imageUrl
    │    └─ Footer: ArticleReactions (лайки/эмодзи)
    │
    ├─ sourceType === 'telegram'
    │    ├─ Заголовок → Link /social/channel/:username
    │    ├─ Badge: Telegram (синий)
    │    ├─ Border-left: #2AABEE
    │    └─ Footer: кнопка "Открыть пост" → Modal + TelegramEmbed
    │
    └─ sourceType === 'youtube'
         ├─ Заголовок → Link /youtube/channel/:channelId
         ├─ Badge: YouTube (красный)
         ├─ Border-left: #FF0000
         ├─ Thumbnail из ytimg.com
         └─ Footer: кнопка "Смотреть видео" → YouTubeEmbed inline
```

---

## 📊 Диаграмма 6: UI-система

```
ui-system/
├── tokens/          ← CSS-переменные (единый источник значений)
│   ├── colors.css   --color-primary-500, --color-surface...
│   ├── spacing.css  --spacing-xs, --spacing-md...
│   └── typography.css --font-size-sm, --font-weight-bold...
│
├── themes/          ← переопределение токенов
│   ├── light.css    :root { --color-surface: #fff; }
│   └── dark.css     [data-theme="dark"] { --color-surface: #0f172a; }
│
├── components/      ← переиспользуемые UI-компоненты
│   ├── button/      .btn, .btn--primary, .btn--sm
│   ├── modal/       .modal, .modal__overlay, .modal__content
│   └── feedback/    .alert, .toast, .notification
│
└── patterns/        ← page-level BEM-блоки
    ├── news-aggregator.css  .news-card, .news-feed, .news-filters
    └── personal-feed.css    .personal-feed, .subscription-manager

BEM-пример:
  .news-card              ← блок
  .news-card__title       ← элемент
  .news-card--new         ← модификатор
  .news-card--telegram    ← модификатор
```

---

*Диаграммы основаны на реальной структуре проекта.*
