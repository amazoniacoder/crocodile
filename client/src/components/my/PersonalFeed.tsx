import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { myApi } from '@/services/myApi';
import { readHistoryApi } from '@/services/myApi';
import { NewsFeed } from '@/components/news/NewsFeed';
import { SubscriptionManager } from './SubscriptionManager';
import { Icon } from '@/ui-system/icons/components';
import { useWebSocket } from '@/contexts/websocket-context';
import { buildFeedKey, saveFeedSlice, loadFeedSlice, saveBookmarks, loadBookmarks } from '@/services/offlineStore';
import type { NewsArticleWithCluster } from '../../../../shared/types/news';

const TG_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.7 8.02c-.12.56-.46.7-.93.43l-2.57-1.89-1.24 1.19c-.14.14-.25.25-.51.25l.18-2.6 4.72-4.26c.2-.18-.05-.28-.32-.1L7.4 14.53l-2.52-.79c-.55-.17-.56-.55.12-.81l9.85-3.8c.46-.17.86.11.79.67z"/>
  </svg>
);

const YT_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/>
  </svg>
);

const SCROLL_SPEED = 8;
type ActiveTab = 'all' | 'telegram' | 'youtube' | 'bookmarks';

interface PersonalFeedProps {
  token: string;
  onLogout: () => void;
  expiresAt?: string | null;
  initialTab?: 'all' | 'telegram' | 'youtube';
  isAdmin?: boolean;
}

export const PersonalFeed: React.FC<PersonalFeedProps> = ({ token, onLogout, expiresAt, initialTab = 'all', isAdmin = false }) => {
  const [, navigate] = useLocation();
  const [articles, setArticles] = useState<NewsArticleWithCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
  const prevInitialTabRef = useRef(initialTab);
  const [subscribedIds, setSubscribedIds] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<{
    search: string;
    dateFrom: string;
    dateTo: string;
  }>({
    search: '',
    dateFrom: '',
    dateTo: '',
  });

  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set());
  const [bookmarkArticles, setBookmarkArticles] = useState<any[]>([]);
  const [readIds, setReadIds] = useState<Set<number>>(() => readHistoryApi.getReadIdsSync());
  const [isOffline, setIsOffline] = useState(false);

  // Skeleton
  const [skeletonVisible, setSkeletonVisible] = useState(true);
  const skeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSkeletonFor = useCallback((ms: number) => {
    if (skeletonTimerRef.current) clearTimeout(skeletonTimerRef.current);
    setSkeletonVisible(true);
    skeletonTimerRef.current = setTimeout(() => setSkeletonVisible(false), ms);
  }, []);
  useEffect(() => () => { if (skeletonTimerRef.current) clearTimeout(skeletonTimerRef.current); }, []);

  // Pending
  const [pendingArticles, setPendingArticles] = useState<NewsArticleWithCluster[]>([]);
  const [pendingSkeletonCount, setPendingSkeletonCount] = useState(0);
  const pendingSkeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevIdsRef = useRef<Set<number>>(new Set());

  // Scroll nav
  const [visibleIndex, setVisibleIndex] = useState(1);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const [scrollDir, setScrollDir] = useState<'up' | 'down' | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const scrollRafRef = useRef<number | null>(null);
  const scrollDirRef = useRef<'up' | 'down' | null>(null);

  const feedRef = useRef<HTMLDivElement>(null);
  const { lastMessage } = useWebSocket();
  const lastMessageRef = useRef<any>(null);
  const activeTabRef = useRef<ActiveTab>('all');
  const searchQueryRef = useRef('');

  const getScrollEl = (): HTMLElement | null =>
    (feedRef.current?.querySelector('.news-feed__list') as HTMLElement) ?? null;

  const stopScroll = () => {
    scrollDirRef.current = null;
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  };

  const handlePaginationPress = (dir: 'up' | 'down') => {
    stopScroll();
    scrollDirRef.current = dir;
    const tick = () => {
      if (!scrollDirRef.current) return;
      const el = getScrollEl();
      if (el) el.scrollTop += scrollDirRef.current === 'down' ? SCROLL_SPEED : -SCROLL_SPEED;
      scrollRafRef.current = requestAnimationFrame(tick);
    };
    scrollRafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => stopScroll(), []);

  // Scroll listener
  useEffect(() => {
    const el = getScrollEl();
    if (!el) return;
    const onScroll = () => {
      const newAtTop = el.scrollTop <= 0;
      const newAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
      const last = (el as any)._lastScrollTop ?? el.scrollTop;
      setScrollDir(!newAtTop && !newAtBottom ? (el.scrollTop > last ? 'down' : 'up') : null);
      (el as any)._lastScrollTop = el.scrollTop;
      setAtTop(newAtTop);
      setAtBottom(newAtBottom);
    };
    (el as any)._lastScrollTop = el.scrollTop;
    setAtTop(el.scrollTop <= 0);
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [articles, loading]);

  const fetchFeed = useCallback(async (pageNum: number, tab: ActiveTab, q = '', from = '', to = '') => {
    if (pageNum === 1) showSkeletonFor(500);
    const sourceType: 'telegram' | 'youtube' | undefined =
      (tab === 'all' || tab === 'bookmarks') ? undefined : tab as 'telegram' | 'youtube';
    try {
      const data = await myApi.getPersonalFeed(token, pageNum, 50, sourceType, q || undefined, from || undefined, to || undefined);
      if (pageNum === 1) {
        setArticles(data.articles);
        prevIdsRef.current = new Set(data.articles.map((a: NewsArticleWithCluster) => a.id));
        if (!q && !from && !to) {
          saveFeedSlice(buildFeedKey({ my: tab }), data.articles);
        }
      } else {
        setArticles(prev => {
          const next = [...prev, ...data.articles];
          prevIdsRef.current = new Set(next.map(a => a.id));
          return next;
        });
      }
      setHasMore(data.hasMore);
      setPage(pageNum);
      setIsOffline(false);
    } catch (error) {
      if (pageNum === 1) {
        const cached = await loadFeedSlice(buildFeedKey({ my: tab }));
        if (cached) {
          setArticles(cached);
          prevIdsRef.current = new Set(cached.map(a => a.id));
          setHasMore(false);
          setPage(1);
          setIsOffline(true);
          setLoading(false);
          setLoadingMore(false);
          return;
        }
      }
      console.error('Failed to fetch feed:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [token, showSkeletonFor]);

  // Синхронизируем activeTab при смене initialTab (навигация /my ↔ /my/telegram ↔ /my/youtube)
  useEffect(() => {
    if (prevInitialTabRef.current === initialTab) return;
    prevInitialTabRef.current = initialTab;
    activeTabRef.current = initialTab;
    setActiveTab(initialTab);
    setArticles([]);
    setPage(1);
    setHasMore(false);
    setPendingArticles([]);
    setLoading(true);
    
    // Сбрасываем фильтры при смене вкладки для независимых лент
    const resetFilters = { search: '', dateFrom: '', dateTo: '' };
    setFilters(resetFilters);
    searchQueryRef.current = '';
    
    fetchFeed(1, initialTab, '', '', '');
  }, [initialTab, fetchFeed]);

  useEffect(() => {
    Promise.all([fetchFeed(1, initialTab), myApi.getSubscriptions(token), myApi.getBookmarks(token)])
      .then(([, { sourceIds }, { articles: bm }]) => {
        setSubscribedIds(new Set(sourceIds));
        setBookmarkedIds(new Set(bm.map((a: any) => a.id)));
        setBookmarkArticles(bm);
        saveBookmarks(bm);
      })
      .catch(async () => {
        const cached = await loadBookmarks();
        if (cached) {
          setBookmarkedIds(new Set(cached.map((a) => a.id)));
          setBookmarkArticles(cached);
        }
      });
    readHistoryApi.getReadIds().then(setReadIds).catch(() => {});
    readHistoryApi.gc().catch(() => {});
  }, [token, initialTab]);


  useEffect(() => {
    if (!lastMessage || lastMessage === lastMessageRef.current) return;
    lastMessageRef.current = lastMessage;
    const tab = activeTabRef.current;
    const sourceType = (tab === 'telegram' || tab === 'youtube') ? tab : undefined;
    myApi.getPersonalFeed(token, 1, 50, sourceType).then(data => {
      const fresh = data.articles.filter((a: NewsArticleWithCluster) => !prevIdsRef.current.has(a.id));
      if (fresh.length > 0) {
        setPendingArticles(prev => {
          const existing = new Set(prev.map(a => a.id));
          const toAdd = fresh.filter(a => !existing.has(a.id));
          return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
        });
        prevIdsRef.current = new Set([...prevIdsRef.current, ...fresh.map(a => a.id)]);
      }
    }).catch(() => {});
  }, [lastMessage, token]);

  const handleTabChange = (tab: ActiveTab) => {
    if (tab === activeTab) return;
    activeTabRef.current = tab;
    setActiveTab(tab);
    setArticles([]);
    setPage(1);
    setHasMore(false);
    setPendingArticles([]);
    
    // Сбрасываем фильтры при смене вкладки для независимых лент
    const resetFilters = { search: '', dateFrom: '', dateTo: '' };
    setFilters(resetFilters);
    searchQueryRef.current = '';
    
    // Меняем URL при переключении вкладок
    if (tab === 'telegram') {
      navigate('/my/telegram');
    } else if (tab === 'youtube') {
      navigate('/my/youtube');
    } else if (tab === 'all') {
      navigate('/my');
    }
    
    if (tab !== 'bookmarks') {
      setLoading(true);
      fetchFeed(1, tab, '', '', '');
    }
  };

  const toggleBookmark = async (articleId: number) => {
    const isBookmarked = bookmarkedIds.has(articleId);
    const next = new Set(bookmarkedIds);
    if (isBookmarked) {
      next.delete(articleId);
      setBookmarkedIds(next);
      setBookmarkArticles(prev => prev.filter((a: any) => a.id !== articleId));
      await myApi.removeBookmark(token, articleId).catch(() => {});
      const updated = bookmarkArticles.filter((a: any) => a.id !== articleId);
      saveBookmarks(updated);
    } else {
      next.add(articleId);
      setBookmarkedIds(next);
      await myApi.addBookmark(token, articleId).catch(() => {});
      myApi.getBookmarks(token).then(({ articles: bm }) => {
        setBookmarkArticles(bm);
        setBookmarkedIds(new Set(bm.map((a: any) => a.id)));
        saveBookmarks(bm);
      }).catch(() => {});
    }
  };

  const handleSearchChange = () => {
    // Удалено - теперь поиск идёт через PersonalFilters
  };

  const handleFiltersChange = (newFilters: { search: string; dateFrom: string; dateTo: string; }) => {
    setFilters(newFilters);
    searchQueryRef.current = newFilters.search;
    setArticles([]);
    setPage(1);
    setHasMore(false);
    setLoading(true);
    fetchFeed(1, activeTabRef.current, newFilters.search, newFilters.dateFrom, newFilters.dateTo);
  };

  const handleFiltersReset = () => {
    const resetFilters = { search: '', dateFrom: '', dateTo: '' };
    setFilters(resetFilters);
    searchQueryRef.current = '';
    setArticles([]);
    setPage(1);
    setHasMore(false);
    setLoading(true);
    fetchFeed(1, activeTabRef.current, '', '', '');
  };

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      fetchFeed(page + 1, activeTabRef.current, filters.search, filters.dateFrom, filters.dateTo);
    }
  }, [loadingMore, hasMore, page, fetchFeed, filters.search, filters.dateFrom, filters.dateTo]);

  const handleAcceptPending = () => {
    const count = pendingArticles.length;
    if (!count) return;
    setPendingSkeletonCount(count);
    if (pendingSkeletonTimerRef.current) clearTimeout(pendingSkeletonTimerRef.current);
    pendingSkeletonTimerRef.current = setTimeout(() => {
      setPendingSkeletonCount(0);
      setArticles(prev => {
        const existing = new Set(prev.map(a => a.id));
        const toAdd = pendingArticles.filter(a => !existing.has(a.id));
        return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
      });
      setPendingArticles([]);
    }, 500);
  };

  const handleSubscriptionsUpdate = (newIds: Set<number>) => {
    setSubscribedIds(newIds);
    setArticles([]);
    setPage(1);
    setLoading(true);
    fetchFeed(1, activeTabRef.current, filters.search, filters.dateFrom, filters.dateTo);
  };

  const handleMarkRead = useCallback((articleId: number) => {
    setReadIds(prev => {
      if (prev.has(articleId)) return prev;
      const next = new Set(prev);
      next.add(articleId);
      readHistoryApi.markRead(articleId).catch(() => {});
      return next;
    });
  }, []);

  const handleArticleClick = useCallback((article: NewsArticleWithCluster) => {
    const sourceType = (article as any).sourceType as string | undefined;
    const channelId = (article as any).sourceChannelId as string | undefined;
    const username = (article as any).channelUsername as string | undefined;

    if (sourceType === 'youtube' && channelId) {
      navigate(`/my/youtube/${channelId}`);
    } else if (sourceType === 'telegram' && username) {
      navigate(`/my/telegram/${username}`);
    }
  }, [navigate]);

  const filteredArticles = articles.filter(article => {
    const sourceId = (article as any).sourceId as number | undefined;
    // Не фильтруем по subscribedIds - API уже возвращает только подписанные каналы
    return true;
  });

  const feedCount = filteredArticles.length;
  const displayVisible = feedCount === 0 ? 0 : Math.min(Math.max(1, visibleIndex), feedCount);
  const showNav = feedCount > 0 && !loading;

  const daysLeft = expiresAt
    ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
    : null;

  useEffect(() => {
    if (feedCount === 0) { setVisibleIndex(1); return; }
    setVisibleIndex(v => Math.min(Math.max(1, v), feedCount));
  }, [feedCount]);

  const emptyMessage =
    activeTab === 'telegram' ? 'Нет Telegram-каналов в подписках' :
    activeTab === 'youtube'  ? 'Нет YouTube-каналов в подписках' :
    'Выберите каналы в панели подписок';

  return (
    <div
      className="news-aggregator"
      ref={feedRef}
      onClick={() => { if (sidebarOpen) setSidebarOpen(false); if (popupOpen) setPopupOpen(false); }}
    >
      {daysLeft !== null && daysLeft <= 7 && (
        <div className="personal-feed__expiry-warn">
          {daysLeft <= 0
            ? 'Срок доступа истёк. Обратитесь к администратору.'
            : `Доступ истекает через ${daysLeft} дн. — обратитесь к администратору для продления.`
          }
        </div>
      )}
      <div className="social-novpn-bar">
        <div className="social-novpn-bar__inner">
          <button
            className={`news-pagination__btn social-novpn-bar__btn${activeTab === 'telegram' ? ' social-novpn-bar__btn--active' : ''}`}
            onClick={() => handleTabChange('telegram')}
            aria-label="Telegram"
          >
            {TG_ICON}
          </button>
          <div className="social-novpn-bar__info">
            <span className="social-novpn-bar__badge">{isAdmin ? 'Лента админа' : 'Моя лента'}</span>
            Персональная лента из выбранных каналов
          </div>
          <button
            className={`news-pagination__btn social-novpn-bar__btn social-novpn-bar__btn--yt${activeTab === 'youtube' ? ' social-novpn-bar__btn--yt-active' : ''}`}
            onClick={() => handleTabChange('youtube')}
            aria-label="YouTube"
          >
            {YT_ICON}
          </button>
        </div>
      </div>

      <div style={{ padding: '0 var(--space-lg) var(--space-sm)', maxWidth: 780, margin: '0 auto', width: '100%', boxSizing: 'border-box' as const, position: 'relative' as const }}>
      </div>

      <div className="news-aggregator__body">
        <section className="news-aggregator__feed">
          {skeletonVisible && (
            <div className="news-feed__skeleton-overlay">
              <div className="news-feed__skeletons" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="news-card__new-skeleton">
                    <div className="news-card__new-skeleton-image" />
                    <div className="news-card__new-skeleton-body">
                      <div className="news-card__new-skeleton-meta" />
                      <div className="news-card__new-skeleton-title" />
                      <div className="news-card__new-skeleton-title news-card__new-skeleton-title--short" />
                      <div className="news-card__new-skeleton-desc" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {filteredArticles.length === 0 && !loading && !skeletonVisible && (
            <div className="social-blocked-overlay">
              <div className="social-blocked-overlay__card">
                <div className="social-blocked-overlay__icon">📚</div>
                <h2 className="social-blocked-overlay__title">Нет подписок</h2>
                <p className="social-blocked-overlay__text">{emptyMessage}</p>
                <button className="social-blocked-overlay__retry" onClick={() => setSidebarOpen(true)}>
                  Выбрать каналы
                </button>
              </div>
            </div>
          )}
          {pendingArticles.length > 0 && (
            <button
              className="news-feed__new-toast"
              onClick={handleAcceptPending}
              aria-label={`${pendingArticles.length} новых статей`}
            >
              <Icon name="list" size={24} aria-hidden />
              <span className="news-feed__new-toast-count">+{pendingArticles.length}</span>
            </button>
          )}
          {activeTab === 'bookmarks' ? (
            <div className="personal-feed__bookmarks">
              {bookmarkArticles.length === 0 ? (
                <div className="social-blocked-overlay">
                  <div className="social-blocked-overlay__card">
                    <div className="social-blocked-overlay__icon">🔖</div>
                    <h2 className="social-blocked-overlay__title">Закладки</h2>
                    <p className="social-blocked-overlay__text">Сохраняйте статьи на потом — нажмите 🔖 на карточке</p>
                  </div>
                </div>
              ) : (
                <NewsFeed
                  articles={bookmarkArticles}
                  loading={false}
                  emptyMessage="Нет закладок"
                  onVisibleIndexChange={setVisibleIndex}
                  bookmarkedIds={bookmarkedIds}
                  onBookmark={toggleBookmark}
                  readIds={readIds}
                  onArticleRead={handleMarkRead}
                  onArticleClick={handleArticleClick}
                  telegramMode="personal-list"
                />
              )}
            </div>
          ) : (
          <NewsFeed
            articles={filteredArticles}
            loading={loading}
            onLoadMore={hasMore ? handleLoadMore : undefined}
            loadingMore={loadingMore}
            emptyMessage={emptyMessage}
            pendingSkeletonCount={pendingSkeletonCount}
            onVisibleIndexChange={setVisibleIndex}
            bookmarkedIds={bookmarkedIds}
            onBookmark={toggleBookmark}
            readIds={readIds}
            onArticleRead={handleMarkRead}
            onArticleClick={handleArticleClick}
            telegramMode="personal-list"
          />
          )}
        </section>
      </div>

      {showNav && (
        <nav className="news-pagination" aria-label="Прокрутка ленты">
          <button
            className={`news-pagination__fast news-pagination__fast--up${(atTop || scrollDir !== 'up') ? ' news-pagination__fast--hidden' : ''}`}
            onClick={() => { const el = getScrollEl(); if (el) el.scrollTo({ top: 0, behavior: 'smooth' }); setScrollDir(null); }}
            aria-label="В начало"
          >
            <span className="news-pagination__fast-arrows">
              <span>&#9650;</span><span>&#9650;</span>
            </span>
          </button>

          <button
            className="news-pagination__btn"
            disabled={atTop}
            onMouseDown={() => handlePaginationPress('up')}
            onMouseUp={stopScroll}
            onMouseLeave={stopScroll}
            onTouchStart={() => handlePaginationPress('up')}
            onTouchEnd={stopScroll}
            aria-label="Прокрутить вверх"
          >&#9650;</button>

          <div className="news-pagination__counter">
            <button
              className="news-pagination__info"
              onClick={e => { e.stopPropagation(); setPopupOpen(v => !v); }}
              aria-label={`Позиция: ${displayVisible} из ${feedCount}`}
            >
              <span className="news-pagination__info-text">{displayVisible}&nbsp;/&nbsp;{feedCount}</span>
            </button>
            {popupOpen && (
              <div className="news-pagination__popup">
                <div className="news-pagination__popup-main">{displayVisible}&nbsp;/&nbsp;{feedCount}</div>
              </div>
            )}
          </div>

          <button
            className="news-pagination__btn"
            disabled={atBottom}
            onMouseDown={() => handlePaginationPress('down')}
            onMouseUp={stopScroll}
            onMouseLeave={stopScroll}
            onTouchStart={() => handlePaginationPress('down')}
            onTouchEnd={stopScroll}
            aria-label="Прокрутить вниз"
          >&#9660;</button>

          <button
            className={`news-pagination__fast news-pagination__fast--down${(atBottom || scrollDir !== 'down') ? ' news-pagination__fast--hidden' : ''}`}
            onClick={() => { const el = getScrollEl(); if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); setScrollDir(null); }}
            aria-label="В конец"
          >
            <span className="news-pagination__fast-arrows">
              <span>&#9660;</span><span>&#9660;</span>
            </span>
          </button>
        </nav>
      )}

      <div className={`news-aggregator__sidebar-tab${sidebarOpen ? ' news-aggregator__sidebar-tab--open' : ''}`}>
        <button
          className="news-aggregator__sidebar-btn"
          onClick={e => { e.stopPropagation(); setSidebarOpen(v => !v); }}
          aria-label="Подписки"
          aria-expanded={sidebarOpen}
        >
          <Icon name={sidebarOpen ? 'x' : 'hamburger'} size={20} />
        </button>
      </div>

      <aside
        className={`news-aggregator__sidebar${sidebarOpen ? ' news-aggregator__sidebar--open' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="news-aggregator__sidebar-header">
          <h3 className="news-aggregator__sidebar-title">Подписки</h3>
        </div>
        <SubscriptionManager
          token={token}
          onClose={() => setSidebarOpen(false)}
          onUpdate={handleSubscriptionsUpdate}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onFiltersReset={handleFiltersReset}
        />
      </aside>
    </div>
  );
};
