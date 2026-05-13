# Эпизод 4: "Frontend: React + TypeScript"

> **Длительность:** 22-25 минут
> **Цель:** Показать архитектуру фронтенда — виртуализация, состояние, роутинг, real-time
> **Аудитория:** Frontend разработчики, fullstack

---

## 🎯 Цели эпизода

- Показать структуру React-приложения с реальным кодом
- Разобрать виртуализированную ленту через @tanstack/react-virtual
- Объяснить управление состоянием через Zustand
- Показать роутинг Wouter с синхронизацией URL
- Разобрать WebSocket real-time уведомления
- Показать UI-систему: BEM, токены, темы

---

## 📝 Сценарий эпизода

### 🎬 Интро (2 минуты)

**[Заставка серии]**

**Ведущий на камеру:**
> Привет! В четвёртом эпизоде переходим на фронтенд. В прошлом эпизоде мы видели как бэкенд собирает новости — сегодня посмотрим как React-приложение их получает, отображает и обновляет в реальном времени.

**[Показать работающее приложение]**

> Вот что мы разберём:
> - Виртуализированная лента — 500 статей без тормозов
> - Zustand — состояние без Redux boilerplate
> - Wouter — роутинг с синхронизацией фильтров в URL
> - WebSocket — тост «N новых статей» без перезагрузки
> - UI-система — BEM, CSS-токены, тёмная тема

---

### 🏗️ Блок 1: Структура приложения (3 минуты)

#### Подблок 1.1: App.tsx — провайдеры и роутинг

**[Открыть client/src/App.tsx]**

**Ведущий:**
> Точка входа — App.tsx. Посмотрим на структуру провайдеров:

```tsx
function App() {
  return (
    <HelmetProvider>
      <ThemeProvider defaultTheme="light" storageKey="theme">
        <ColorThemeProvider>
          <FontSizeProvider>
            <NotificationProvider>
              <WebSocketProvider>
                <DisplaySettingsProvider>
                  <RouteProvider>
                    <AppInner />
                  </RouteProvider>
                </DisplaySettingsProvider>
              </WebSocketProvider>
            </NotificationProvider>
          </FontSizeProvider>
        </ColorThemeProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}
```

**Ключевые моменты:**
- Каждый провайдер — одна ответственность
- `WebSocketProvider` — real-time соединение для всего приложения
- `ThemeProvider` + `ColorThemeProvider` — тема и цветовая схема раздельно
- `AdminMonitorPage` — lazy import, не грузится при обычном посещении

#### Подблок 1.2: Роутинг через Wouter

**[Показать Switch/Route в AppInner]**

```tsx
// Wouter — минималистичный роутер (2KB vs 50KB React Router)
<Switch>
  <Route path="/"><HomePage /></Route>
  <Route path="/russia"><RussiaPage /></Route>
  <Route path="/world"><WorldPage /></Route>
  <Route path="/news/:id-:slug"><NewsDetailPage /></Route>
  <Route path="/my"><MyFeedPage /></Route>
  <Route path="/social/channel/:username">
    {(params) => <TelegramChannelPage params={params} />}
  </Route>
</Switch>
```

**Почему Wouter, а не React Router:**
- 2KB vs 50KB — в 25 раз легче
- Простой API без лишних абстракций
- Достаточно для SPA без SSR

---

### 🔄 Блок 2: useNewsFeed — сердце ленты (6 минут)

#### Подблок 2.1: Архитектура хука

**[Открыть client/src/hooks/useNewsFeed.ts]**

**Ведущий:**
> Весь цикл жизни ленты — в одном хуке. Посмотрим что он делает:

```typescript
export function useNewsFeed({ region, filters, archiveWeekShift, enabledRegions }) {
  // Состояние
  const [articles, setArticles] = useState<NewsArticleWithCluster[]>([]);
  const [pendingArticles, setPendingArticles] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // WebSocket → тихое обновление
  const { lastMessage } = useWebSocket();

  // IDB preload при маунте — показываем кэш пока грузится сеть
  useEffect(() => {
    loadFeedSlice(feedKey).then(cached => {
      if (cached?.length) { setArticles(cached); setLoading(false); }
    });
  }, []);

  // Основная загрузка при смене фильтров
  useEffect(() => {
    fetchNewsRef.current(stableFilters, shouldMarkNew);
  }, [filtersKey, region]);

  // WebSocket → тихое обновление в фоне
  useEffect(() => {
    if (!lastMessage) return;
    fetchNewsRef.current(filtersRef.current, true); // markNew=true
  }, [lastMessage]);
}
```

#### Подблок 2.2: Паттерн pending articles

**Ведущий:**
> Ключевая UX-деталь — новые статьи не вставляются сразу. Они накапливаются в `pendingArticles`:

```typescript
// markNew=true → статьи идут в pending, не в основной список
if (markNew) {
  const freshAllowed = data.articles.filter(a =>
    !prevIdsRef.current.has(a.id) && isIncomingAllowed(a)
  );
  if (freshAllowed.length > 0) {
    setUnreadCount(prev => prev + freshAllowed.length);
    setPendingArticles(prev => [...freshAllowed, ...prev]);
  }
}

// Пользователь видит тост "15 новых статей"
// Кликает → acceptPending() → статьи вставляются наверх
const acceptPending = useCallback((onBeforeInsert?) => {
  setNewIds(new Set(pendingArticles.map(a => a.id)));
  setTimeout(() => setNewIds(new Set()), 8000); // анимация 8 сек
  setArticles(prev => [...pendingArticles.filter(...), ...prev]);
  setPendingArticles([]);
  setUnreadCount(0);
}, [pendingArticles]);
```

**Почему так:**
- Пользователь не теряет позицию в ленте
- Контролирует когда принять новые статьи
- PWA Badge обновляется автоматически

#### Подблок 2.3: Offline fallback

```typescript
// При ошибке сети → IndexedDB
} catch (err) {
  const cached = await loadFeedSlice(feedKey);
  if (cached) {
    setArticles(cached);
    setIsOffline(true); // показываем баннер
    return;
  }
  setError('Не удалось загрузить новости...');
}
```

**Ведущий:**
> Три уровня данных: сеть → IDB кэш → ошибка. Пользователь всегда видит контент.

---

### ⚡ Блок 3: Виртуализация ленты (5 минут)

#### Подблок 3.1: Проблема без виртуализации

**[Показать слайд с проблемой]**

```
500 статей × 176px = 88,000px DOM
Каждая карточка: ~15 DOM-узлов
Итого: 7,500 DOM-узлов

Результат:
❌ Первый рендер: 2-3 секунды
❌ Скролл: 10-15fps
❌ Память: 200-300MB
```

#### Подблок 3.2: useVirtualizer

**[Открыть client/src/components/news/NewsFeed.tsx]**

```tsx
const virtualizer = useVirtualizer({
  count: articles.length,
  getScrollElement: () => listRef.current,
  estimateSize: () => 176,      // начальная оценка высоты
  overscan: 6,                  // рендерим 6 элементов за экраном
  measureElement: (element) => {
    // Реальная высота с учётом margin
    const styles = window.getComputedStyle(element);
    const mt = parseFloat(styles.marginTop) || 0;
    const mb = parseFloat(styles.marginBottom) || 0;
    return element.getBoundingClientRect().height + mt + mb;
  },
});

// Только видимые элементы в DOM
{virtualizer.getVirtualItems().map((item) => (
  <div
    key={item.key}
    data-index={item.index}
    ref={virtualizer.measureElement}   // автоизмерение
    style={{ transform: `translateY(${item.start}px)` }}
  >
    <NewsCard article={articles[item.index]} />
  </div>
))}
```

#### Подблок 3.3: Бесконечная прокрутка

```tsx
// Триггер когда до конца осталось 5 элементов
useEffect(() => {
  const lastItem = virtualItems[virtualItems.length - 1];
  if (lastItem?.index >= articles.length - 5) {
    if (!loadMoreCalledRef.current) {
      loadMoreCalledRef.current = true;
      onLoadMore();
    }
  }
}, [virtualItems, articles.length, onLoadMore]);
```

**Результат с виртуализацией:**
```
✅ В DOM: ~15 карточек (видимые + overscan)
✅ Первый рендер: < 100ms
✅ Скролл: 60fps
✅ Память: стабильная
```

---

### 🗃️ Блок 4: Zustand — управление состоянием (3 минуты)

#### Подблок 4.1: Простота Zustand

**[Открыть client/src/store/newsRegionStore.ts]**

```typescript
// Весь store — 10 строк
export const useNewsRegionStore = create<NewsRegionStore>((set) => ({
  region: 'all',
  setRegion: (region) => set({ region }),
}));

// Использование в компоненте
const { region, setRegion } = useNewsRegionStore();
```

**Сравнение с Redux:**
```
Redux:                    Zustand:
action types              нет
action creators           нет
reducers                  нет
dispatch                  нет
connect/useSelector       useStore()
~50 строк boilerplate     ~5 строк
```

#### Подблок 4.2: Синхронизация фильтров с URL

**Ведущий:**
> Фильтры хранятся в URL — отфильтрованной лентой можно поделиться:

```typescript
// NewsFilters читает из URL при маунте
const [searchParams] = useSearch();
const initialCategory = searchParams.get('category') ?? 'all';

// При изменении фильтра → обновляем URL
const handleCategoryChange = (cat: string) => {
  setFilters(prev => ({ ...prev, category: cat }));
  navigate(`?category=${cat}&region=${filters.region}`);
};
```

---

### 🃏 Блок 5: NewsCard — умная карточка (4 минуты)

#### Подблок 5.1: Три режима карточки

**[Открыть client/src/components/news/NewsCard.tsx]**

```tsx
// Одна карточка — три типа контента
const isTelegram = article.sourceType === 'telegram';
const isYouTube  = article.sourceType === 'youtube';
// По умолчанию — RSS

// Telegram: кнопка "Открыть пост" → Modal с TelegramEmbed
// YouTube: кнопка "Смотреть видео" → YouTubeEmbed inline
// RSS: ссылка на /news/:id-:slug
```

#### Подблок 5.2: Анимация новых статей

```typescript
// Новые статьи показываются как skeleton, потом появляются
const [phase, setPhase] = useState<'skeleton' | 'content'>(
  isNew ? 'skeleton' : 'content'
);

useEffect(() => {
  if (!isNew) return;
  // Staggered анимация: каждая карточка с задержкой
  const delay = Math.min(newIndex * 200, 1600) + 2000;
  const t = setTimeout(() => setPhase('content'), delay);
  return () => clearTimeout(t);
}, [isNew, newIndex]);
```

#### Подблок 5.3: Относительное время

```typescript
// Обновляется каждую минуту без перерендера всей ленты
const useRelativeTime = (iso: string): string => {
  const [label, setLabel] = useState(() => formatTime(iso));
  useEffect(() => {
    const id = setInterval(() => setLabel(formatTime(iso)), 60000);
    return () => clearInterval(id);
  }, [iso]);
  return label;
};

// "5 мин назад" → "6 мин назад" → ... → "2 ч назад"
```

---

### 🎨 Блок 6: UI-система (2 минуты)

#### Подблок 6.1: BEM + CSS-токены

**[Показать client/src/ui-system/]**

```
ui-system/
├── tokens/          ← CSS-переменные (цвета, отступы, типографика)
│   ├── colors.css
│   ├── spacing.css
│   └── typography.css
├── components/      ← переиспользуемые компоненты
│   ├── button/
│   ├── modal/
│   └── feedback/
├── themes/          ← светлая/тёмная тема
│   ├── light.css
│   └── dark.css
└── patterns/        ← page-level стили (BEM)
    ├── news-aggregator.css
    └── personal-feed.css
```

```css
/* Токены — одно место для всех значений */
:root {
  --color-primary: #2563eb;
  --spacing-md: 16px;
  --radius-card: 8px;
}

/* BEM — предсказуемые имена */
.news-card { }
.news-card__title { }
.news-card__title--highlighted { }
.news-card--new { }
```

---

### 🎓 Заключение (1 минута)

**Ведущий:**
> Подведём итоги фронтенда:

1. **Wouter** — лёгкий роутинг, URL как источник истины для фильтров
2. **useNewsFeed** — весь цикл ленты в одном хуке: сеть, IDB, WebSocket, pending
3. **@tanstack/react-virtual** — 500 статей, 15 DOM-узлов в любой момент
4. **Zustand** — состояние без boilerplate
5. **UI-система** — BEM + CSS-токены + темы

> В следующем эпизоде — AI интеграция: NER-сервис на Python, кластеризация похожих новостей, Entity-Driven подход.

---

## 🎥 Технические требования

### Файлы для демонстрации
```
client/src/
├── App.tsx
├── hooks/useNewsFeed.ts
├── components/news/
│   ├── NewsFeed.tsx
│   └── NewsCard.tsx
├── store/newsRegionStore.ts
└── ui-system/
    ├── tokens/colors.css
    └── themes/dark.css
```

### Демо в браузере
- Открыть DevTools → Performance → показать 60fps при скролле
- Открыть DevTools → Elements → показать что в DOM только ~15 карточек
- Показать тост с новыми статьями (запустить сбор вручную)
- Переключить тёмную тему
- Показать синхронизацию фильтров в URL
