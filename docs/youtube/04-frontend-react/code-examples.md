# Примеры кода для Эпизода 4: "Frontend: React + TypeScript"

> Все примеры взяты из реального кода проекта

---

## 🏗️ App.tsx — провайдеры и роутинг

```tsx
// client/src/App.tsx

// Lazy import — AdminMonitorPage не грузится при обычном посещении
const AdminMonitorPage = lazy(() => import('./pages/admin-monitor'));

function AppInner() {
  useNewsNotifications(); // WebSocket → тост с новыми статьями
  const [location] = useLocation();

  useEffect(() => {
    if (!location.startsWith('/admin')) {
      analytics.pageview(location); // анонимная аналитика
    }
  }, [location]);

  return (
    <ErrorBoundary level="page" resetOnPropsChange resetKeys={[location]}>
      <Switch>
        {/* Админка — lazy, без Layout */}
        <Route path="/admin/monitor">
          <Suspense fallback={null}><AdminMonitorPage /></Suspense>
        </Route>

        {/* Все публичные страницы — в Layout */}
        <Route>
          <Layout>
            <Switch>
              <Route path="/"><HomePage /></Route>
              <Route path="/russia"><RussiaPage /></Route>
              <Route path="/world"><WorldPage /></Route>
              <Route path="/news/:id-:slug"><NewsDetailPage /></Route>
              <Route path="/social/channel/:username">
                {(params) => <TelegramChannelPage params={params} />}
              </Route>
              <Route path="/my"><MyFeedPage /></Route>
              <Route component={NotFoundPage} />
            </Switch>
          </Layout>
        </Route>
      </Switch>
      <PwaUpdateToast />
    </ErrorBoundary>
  );
}

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

---

## 🔄 useNewsFeed — ключевые части

```typescript
// client/src/hooks/useNewsFeed.ts

const MAX_ARTICLES_IN_FEED = 500;

export function useNewsFeed({ region, filters, archiveWeekShift, enabledRegions }) {
  const [articles, setArticles] = useState<NewsArticleWithCluster[]>([]);
  const [pendingArticles, setPendingArticles] = useState<NewsArticleWithCluster[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());

  const prevIdsRef = useRef<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const { lastMessage } = useWebSocket();

  // ── IDB preload при маунте ──────────────────────────────────────
  // Показываем кэш пока грузится сеть (только для простых запросов)
  useEffect(() => {
    const canPreload = !filters.search.trim() && !filters.date && !filters.city;
    if (!canPreload) return;
    const feedKey = buildFeedKey({ region, category: ... });
    loadFeedSlice(feedKey).then(cached => {
      if (cached?.length) {
        setArticles(cached);
        setLoading(false);
        prevIdsRef.current = new Set(cached.map(a => a.id));
      }
    });
  }, []); // только при маунте

  // ── Основная загрузка ───────────────────────────────────────────
  const fetchNews = useCallback(async (f: NewsFiltersState, markNew = false) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const endpoint = f.search.trim()
        ? `/api/news/search?q=${f.search}&...`
        : `/api/news?region=${f.region}&...`;

      const res = await fetch(endpoint, { signal: abortRef.current.signal });
      const data: NewsListResponse = await res.json();

      if (markNew) {
        // Новые статьи → pending, не в основной список
        const fresh = data.articles.filter(a =>
          !prevIdsRef.current.has(a.id) && isIncomingAllowed(a)
        );
        if (fresh.length > 0) {
          setUnreadCount(prev => prev + fresh.length);
          setPendingArticles(prev => [...fresh, ...prev]);
        }
      } else {
        // Обычная загрузка → заменяем список
        setArticles(data.articles);
        setHasMore(data.hasMore ?? false);
        prevIdsRef.current = new Set(data.articles.map(a => a.id));
        // Сохраняем в IDB для офлайн
        saveFeedSlice(feedKey, data.articles);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      // Offline fallback → IDB
      const cached = await loadFeedSlice(feedKey);
      if (cached) {
        setArticles(cached);
        setIsOffline(true);
      } else {
        setError('Не удалось загрузить новости...');
      }
    }
  }, [archiveWeekShift, region, isIncomingAllowed]);

  // ── WebSocket → тихое обновление ───────────────────────────────
  useEffect(() => {
    if (!lastMessage) return;
    fetchNewsRef.current(filtersRef.current, true); // markNew=true
  }, [lastMessage]);

  // ── Принять pending статьи ──────────────────────────────────────
  const acceptPending = useCallback((onBeforeInsert?: () => void) => {
    if (pendingArticles.length === 0) return;
    onBeforeInsert?.();
    // Подсветка новых статей на 8 секунд
    setNewIds(new Set(pendingArticles.map(a => a.id)));
    setTimeout(() => setNewIds(new Set()), 8000);
    // Вставляем наверх без дубликатов
    setArticles(prev => {
      const existing = new Set(prev.map(a => a.id));
      const toAdd = pendingArticles.filter(a => !existing.has(a.id));
      return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
    });
    setPendingArticles([]);
    setUnreadCount(0);
  }, [pendingArticles]);

  // ── PWA Badge ───────────────────────────────────────────────────
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    if (unreadCount > 0) navigator.setAppBadge(unreadCount);
    else navigator.clearAppBadge();
  }, [unreadCount]);

  return { articles, pendingArticles, unreadCount, newIds, hasMore,
           loading, error, isOffline, loadMore, acceptPending, ... };
}
```

---

## ⚡ NewsFeed — виртуализация

```tsx
// client/src/components/news/NewsFeed.tsx

export const NewsFeed: React.FC<NewsFeedProps> = ({
  articles, loading, onLoadMore, loadingMore, newIds, ...
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: articles.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 176,   // начальная оценка высоты карточки
    overscan: 6,               // рендерим 6 элементов за пределами экрана
    measureElement: (element) => {
      // Реальная высота с учётом margin (карточки разной высоты)
      const styles = window.getComputedStyle(element);
      const mt = parseFloat(styles.marginTop) || 0;
      const mb = parseFloat(styles.marginBottom) || 0;
      return element.getBoundingClientRect().height + mt + mb;
    },
  });

  // Бесконечная прокрутка — триггер за 5 элементов до конца
  const loadMoreCalledRef = useRef(false);
  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (lastItem?.index >= articles.length - 5) {
      if (!loadMoreCalledRef.current) {
        loadMoreCalledRef.current = true;
        onLoadMore?.();
      }
    }
  }, [virtualItems, articles.length, onLoadMore]);

  // Сброс флага когда пришли новые статьи
  useEffect(() => {
    if (articles.length > prevArticlesLengthRef.current) {
      loadMoreCalledRef.current = false;
    }
    prevArticlesLengthRef.current = articles.length;
  }, [articles.length]);

  return (
    <div className="news-feed">
      <div className="news-feed__list" ref={listRef}>
        {loading && !articles.length && <FeedSkeleton />}

        {/* Виртуальный контейнер — высота = сумма всех элементов */}
        <div
          className="news-feed__virtual"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((item) => (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}  // автоизмерение реальной высоты
              className="news-feed__virtual-item"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <NewsCard
                article={articles[item.index]}
                isNew={newIds?.has(articles[item.index].id) ?? false}
                newIndex={newOrder.get(articles[item.index].id) ?? 0}
              />
            </div>
          ))}
        </div>

        {loadingMore && <div className="news-feed__load-more-spinner" />}
      </div>
    </div>
  );
};
```

---

## 🃏 NewsCard — три типа контента

```tsx
// client/src/components/news/NewsCard.tsx

export const NewsCard: React.FC<NewsCardProps> = ({ article, isNew, newIndex, ... }) => {
  const isTelegram = article.sourceType === 'telegram';
  const isYouTube  = article.sourceType === 'youtube';
  const [embedOpen, setEmbedOpen] = useState(false);

  // Анимация появления новых статей — staggered skeleton
  const [phase, setPhase] = useState<'skeleton' | 'content'>(
    isNew ? 'skeleton' : 'content'
  );
  useEffect(() => {
    if (!isNew) return;
    const delay = Math.min(newIndex * 200, 1600) + 2000; // max 3.6s
    const t = setTimeout(() => setPhase('content'), delay);
    return () => clearTimeout(t);
  }, [isNew, newIndex]);

  if (phase === 'skeleton') return <SkeletonCard />;

  return (
    <article className={`news-card
      ${isNew ? ' news-card--new' : ''}
      ${isTelegram ? ' news-card--telegram' : ''}
      ${isYouTube ? ' news-card--youtube' : ''}
    `}>
      <div className="news-card__body">
        <NewsCardImage src={article.imageUrl} category={article.category} />
        <div className="news-card__content">
          <div className="news-card__meta">
            <span className="news-card__source">{article.sourceName}</span>
            {isTelegram && <TelegramBadge />}
            {isYouTube && <YouTubeBadge />}
            <time className="news-card__time">{relativeTime}</time>
          </div>

          {/* Заголовок — разные ссылки для разных типов */}
          <h2 className="news-card__title">
            {isTelegram && channelUsername ? (
              <Link href={`/social/channel/${channelUsername}`}>
                {highlightText(article.title, highlightQuery)}
              </Link>
            ) : isYouTube && videoId ? (
              <Link href={`/youtube/channel/${channelId}`}>
                {highlightText(article.title, highlightQuery)}
              </Link>
            ) : (
              <Link href={newsPath(article.id, article.title)}>
                {highlightText(article.title, highlightQuery)}
              </Link>
            )}
          </h2>
        </div>
      </div>

      {/* Embed для Telegram */}
      {isTelegram && channelUsername && messageId && embedOpen && (
        <Modal isOpen onClose={() => setEmbedOpen(false)} size="full">
          <TelegramEmbed username={channelUsername} messageId={messageId} />
        </Modal>
      )}

      {/* Embed для YouTube — inline */}
      {isYouTube && videoId && embedOpen && (
        <YouTubeEmbed videoId={videoId} open={embedOpen} />
      )}

      <div className="news-card__footer">
        {isTelegram && (
          <button onClick={() => setEmbedOpen(v => !v)}>
            {embedOpen ? 'Закрыть пост' : 'Открыть пост'}
          </button>
        )}
        {isYouTube && (
          <button onClick={() => setEmbedOpen(v => !v)}>
            {embedOpen ? 'Скрыть видео' : 'Смотреть видео'}
          </button>
        )}
        {!isTelegram && !isYouTube && (
          <ArticleReactions articleId={article.id} />
        )}
      </div>
    </article>
  );
};

// Относительное время — обновляется каждую минуту
const useRelativeTime = (iso: string): string => {
  const [label, setLabel] = useState(() => formatTime(iso));
  useEffect(() => {
    const id = setInterval(() => setLabel(formatTime(iso)), 60000);
    return () => clearInterval(id);
  }, [iso]);
  return label;
};
```

---

## 🗃️ Zustand — состояние

```typescript
// client/src/store/newsRegionStore.ts
// Минимальный store — только то что нужно глобально

export const useNewsRegionStore = create<NewsRegionStore>((set) => ({
  region: 'all',
  setRegion: (region) => set({ region }),
}));

// client/src/store/newsNotificationsStore.ts
export const useNewsNotificationsStore = create<NewsNotificationsStore>((set) => ({
  unreadCount: 0,
  pendingCount: 0,
  increment: (count) => set(state => ({ unreadCount: state.unreadCount + count })),
  reset: () => set({ unreadCount: 0, pendingCount: 0 }),
}));

// Использование — без connect, без dispatch
function Header() {
  const { region, setRegion } = useNewsRegionStore();
  return <RegionTabs value={region} onChange={setRegion} />;
}
```

---

## 🎨 UI-система — токены и темы

```css
/* client/src/ui-system/tokens/colors.css */
:root {
  --color-primary-500: #2563eb;
  --color-primary-600: #1d4ed8;
  --color-surface: #ffffff;
  --color-surface-secondary: #f8fafc;
  --color-text-primary: #1e293b;
  --color-text-secondary: #64748b;
  --color-border: #e2e8f0;
}

/* client/src/ui-system/themes/dark.css */
[data-theme="dark"] {
  --color-surface: #0f172a;
  --color-surface-secondary: #1e293b;
  --color-text-primary: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-border: #334155;
}

/* client/src/ui-system/patterns/news-aggregator.css — BEM */
.news-card { background: var(--color-surface); border-radius: var(--radius-card); }
.news-card__title { font-size: var(--font-size-lg); }
.news-card__title--highlighted { background: var(--color-primary-100); }
.news-card--new { animation: slideIn 0.3s ease; }
.news-card--telegram { border-left: 3px solid #2AABEE; }
.news-card--youtube { border-left: 3px solid #FF0000; }
```

---

*Все примеры соответствуют реальному production-коду проекта.*
