import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { NewsFeed } from './NewsFeed';
import { SocialFilters, SOCIAL_FILTERS_DEFAULT } from './SocialFilters';
import type { SocialFiltersState } from './SocialFilters';
import { Icon } from '@/ui-system/icons/components';
import { useWebSocket } from '@/contexts/websocket-context';
import { buildSocialFeedKey, saveFeedSlice, loadFeedSlice } from '@/services/offlineStore';
import { readHistoryApi } from '@/services/myApi';
import type { NewsArticleWithCluster, NewsListResponse } from '../../../../shared/types/news';

const SCROLL_SPEED = 8;
const ESTIMATE_HEIGHT = 176;

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

interface SocialAggregatorProps {
  channelUsername?: string;
  channelId?: string;
  sourceType?: 'telegram' | 'youtube';
  novpnBanner?: boolean;
}

export const SocialAggregator: React.FC<SocialAggregatorProps> = ({ channelUsername, channelId, sourceType = 'telegram', novpnBanner }) => {
  const [, navigate] = useLocation();
  const [articles, setArticles] = useState<NewsArticleWithCluster[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [skeletonVisible, setSkeletonVisible] = useState(true);
  const skeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSkeletonFor = useCallback((ms: number) => {
    if (skeletonTimerRef.current) clearTimeout(skeletonTimerRef.current);
    setSkeletonVisible(true);
    skeletonTimerRef.current = setTimeout(() => setSkeletonVisible(false), ms);
  }, []);

  useEffect(() => () => { if (skeletonTimerRef.current) clearTimeout(skeletonTimerRef.current); }, []);
  const [error, setError] = useState<'blocked' | 'network' | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingArticles, setPendingArticles] = useState<NewsArticleWithCluster[]>([]);
  const [filters, setFilters] = useState<SocialFiltersState>(() => {
    try {
      const raw = sessionStorage.getItem(`social:filters:${sourceType}`);
      return raw ? (JSON.parse(raw) as SocialFiltersState) : SOCIAL_FILTERS_DEFAULT;
    } catch { return SOCIAL_FILTERS_DEFAULT; }
  });
  const [pickerReady, setPickerReady] = useState(false);

  const handleFiltersChange = (next: SocialFiltersState) => {
    setFilters(next);
    try { sessionStorage.setItem(`social:filters:${sourceType}`, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [visibleIndex, setVisibleIndex] = useState(1);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const [scrollDir, setScrollDir] = useState<'up' | 'down' | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<number>>(() => readHistoryApi.getReadIdsSync());

  const abortRef = useRef<AbortController | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);
  const scrollDirRef = useRef<'up' | 'down' | null>(null);
  const prevIdsRef = useRef<Set<number>>(new Set());
  const scrollSnapshotRef = useRef<{ scrollTop: number } | null>(null);
  const { lastMessage } = useWebSocket();
  const lastMessageRef = useRef<any>(null);

  const getScrollEl = (): HTMLElement | null =>
    (feedRef.current?.querySelector('.news-feed__list') as HTMLElement) ?? null;

  const buildParams = useCallback((p: number) => {
    const params = new URLSearchParams();
    params.set('sourceType', sourceType);
    if (channelUsername) params.set('channelUsername', channelUsername);
    if (channelId) params.set('channelId', channelId);
    if (pickerReady && Object.keys(filters.enabledChannels).length > 0) {
      const enabledIds = Object.entries(filters.enabledChannels)
        .filter(([, v]) => v === true)
        .map(([k]) => k)
        .join(',');
      if (enabledIds) params.set('sourceIds', enabledIds);
    }
    params.set('page', String(p));
    params.set('limit', '50');
    return params;
  }, [channelUsername, filters.enabledChannels, pickerReady]);

  const fetchArticles = useCallback(async (markNew = false) => {
    if (!markNew) {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setLoading(true);
      setError(null);
      setIsOffline(false);
      setArticles([]);
      showSkeletonFor(500);
    }
    try {
      const res = await fetch(`/api/news?${buildParams(1)}`, {
        signal: markNew ? undefined : abortRef.current!.signal,
      });
      if (!res.ok) {
        if (!markNew) setError('network');
        return;
      }
      const data: NewsListResponse = await res.json();

      if (markNew) {
        const fresh = data.articles.filter(a => !prevIdsRef.current.has(a.id));
        if (fresh.length > 0) {
          setPendingArticles(prev => {
            const existing = new Set(prev.map(a => a.id));
            const toAdd = fresh.filter(a => !existing.has(a.id));
            return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
          });
          prevIdsRef.current = new Set([...prevIdsRef.current, ...fresh.map(a => a.id)]);
        }
        setTotal(data.total);
      } else {
        setArticles(data.articles);
        setTotal(data.total);
        setPage(1);
        setHasMore(data.hasMore ?? false);
        prevIdsRef.current = new Set(data.articles.map(a => a.id));
        const feedKey = buildSocialFeedKey(sourceType, channelUsername ?? channelId);
        saveFeedSlice(feedKey, data.articles);
      }
    } catch (err: any) {
      if (!markNew && err.name !== 'AbortError') {
        const feedKey = buildSocialFeedKey(sourceType, channelUsername ?? channelId);
        const cached = await loadFeedSlice(feedKey);
        if (cached) {
          setArticles(cached);
          setTotal(cached.length);
          setPage(1);
          setHasMore(false);
          setIsOffline(true);
          setLoading(false);
          return;
        }
        try {
          await fetch('https://www.google.com', { mode: 'no-cors', cache: 'no-store' });
          setError('blocked');
        } catch {
          setError('network');
        }
      }
    } finally {
      if (!markNew) setLoading(false);
    }
  }, [buildParams, sourceType, channelUsername, channelId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await fetch(`/api/news?${buildParams(nextPage)}`);
      if (!res.ok) return;
      const data: NewsListResponse = await res.json();
      setArticles(prev => {
        const existing = new Set(prev.map((a: NewsArticleWithCluster) => a.id));
        const toAdd = data.articles.filter((a: NewsArticleWithCluster) => !existing.has(a.id));
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
      setPage(nextPage);
      setHasMore(data.hasMore ?? false);
    } catch { /* ignore */ } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, buildParams]);

  const fetchArticlesRef = useRef(fetchArticles);
  useEffect(() => { fetchArticlesRef.current = fetchArticles; }, [fetchArticles]);

  useEffect(() => {
    fetchArticles();
    readHistoryApi.getReadIds().then(setReadIds).catch(() => {});
    readHistoryApi.gc().catch(() => {});
    return () => abortRef.current?.abort();
  }, [fetchArticles]);

  useEffect(() => {
    lastMessageRef.current = lastMessage;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!lastMessage || lastMessage === lastMessageRef.current) return;
    lastMessageRef.current = lastMessage;
    fetchArticlesRef.current(true);
  }, [lastMessage]);

  useEffect(() => {
    const snap = scrollSnapshotRef.current;
    if (!snap) return;
    scrollSnapshotRef.current = null;
    const el = getScrollEl();
    if (el) el.scrollTop = snap.scrollTop;
  }, [articles]);

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

  const [pendingSkeletonCount, setPendingSkeletonCount] = useState(0);
  const pendingSkeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAcceptPending = () => {
    const count = pendingArticles.length;
    if (!count) return;
    const el = getScrollEl();
    const savedScrollTop = el ? el.scrollTop : 0;
    setPendingSkeletonCount(count);
    if (pendingSkeletonTimerRef.current) clearTimeout(pendingSkeletonTimerRef.current);
    pendingSkeletonTimerRef.current = setTimeout(() => {
      setPendingSkeletonCount(0);
      setArticles(prev => {
        const existing = new Set(prev.map(a => a.id));
        const toAdd = pendingArticles.filter(a => !existing.has(a.id));
        return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
      });
      if (el && savedScrollTop > 0) {
        scrollSnapshotRef.current = { scrollTop: savedScrollTop + count * ESTIMATE_HEIGHT };
      }
      setPendingArticles([]);
    }, 500);
  };

  const channelsInitialized = pickerReady && Object.keys(filters.enabledChannels).length > 0;

  const filteredArticles = articles.filter(article => {
    const sourceId = (article as any).sourceId as number | undefined;
    if (channelsInitialized) {
      if (sourceId === undefined) return false;
      if (filters.enabledChannels[sourceId] !== true) return false;
    }
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      return article.title.toLowerCase().includes(q) ||
        (article.description ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  const hasActiveFilters = filters.search.trim() !== '' ||
    Object.values(filters.enabledChannels).some(v => v === false);

  const feedCount = filteredArticles.length;

  useEffect(() => {
    if (feedCount === 0) { setVisibleIndex(1); return; }
    setVisibleIndex(v => Math.min(Math.max(1, v), feedCount));
  }, [feedCount]);

  const displayVisible = feedCount === 0 ? 0 : Math.min(Math.max(1, visibleIndex), feedCount);
  const showNav = filteredArticles.length > 0 && !loading;
  const highlightSourceId = filters.selectedChannelId;

  const handleArticleClick = (article: NewsArticleWithCluster) => {
    if (sourceType === 'youtube') {
      const channelId = (article as any).sourceChannelId as string | undefined;
      console.log('[SocialAggregator] YouTube click:', { channelId, article });
      if (channelId) {
        navigate(`/youtube/channel/${channelId}?scrollTo=${article.id}`);
      } else {
        console.warn('[SocialAggregator] No channelId found for YouTube article');
      }
    } else {
      const username = (article as any).channelUsername as string | undefined;
      if (username) navigate(`/social/channel/${username}?scrollTo=${article.id}`);
    }
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

  return (
    <div
      className="news-aggregator"
      ref={feedRef}
      onClick={() => { if (sidebarOpen) setSidebarOpen(false); }}
    >
      {novpnBanner && (
        <div className="social-novpn-bar">
          <div className="social-novpn-bar__inner">
            <button
              className={`news-pagination__btn social-novpn-bar__btn${sourceType === 'telegram' ? ' social-novpn-bar__btn--active' : ''}`}
              onClick={() => navigate('/social')}
              aria-label="Telegram"
            >
              {TG_ICON}
            </button>
            <div className="social-novpn-bar__info">
              {sourceType === 'youtube' ? (
                <><span className="social-novpn-bar__badge social-novpn-bar__badge--yt">YouTube</span>
                Смотрите YouTube без ограничений — видео собираются нашим сервером</>
              ) : (
                <><span className="social-novpn-bar__badge">VPN-free</span>
                Читайте Telegram без VPN — посты собираются нашим сервером</>
              )}
            </div>
            <button
              className={`news-pagination__btn social-novpn-bar__btn social-novpn-bar__btn--yt${sourceType === 'youtube' ? ' social-novpn-bar__btn--yt-active' : ''}`}
              onClick={() => navigate('/youtube')}
              aria-label="YouTube"
            >
              {YT_ICON}
            </button>
          </div>
        </div>
      )}

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
          {error === 'blocked' && (
            <div className="social-blocked-overlay">
              <div className="social-blocked-overlay__card">
                <div className="social-blocked-overlay__icon">🚫</div>
                <h2 className="social-blocked-overlay__title">Доступ заблокирован</h2>
                <p className="social-blocked-overlay__text">
                  Этот контент недоступен в вашем регионе.<br />
                  Для просмотра воспользуйтесь VPN.
                </p>
                <button className="social-blocked-overlay__retry" onClick={() => { setError(null); fetchArticles(); }}>
                  Попробовать снова
                </button>
              </div>
            </div>
          )}
          {error === 'network' && (
            <div className="social-blocked-overlay">
              <div className="social-blocked-overlay__card">
                <div className="social-blocked-overlay__icon">📵</div>
                <h2 className="social-blocked-overlay__title">Нет соединения</h2>
                <p className="social-blocked-overlay__text">Проверьте подключение к интернету.</p>
                <button className="social-blocked-overlay__retry" onClick={() => { setError(null); fetchArticles(); }}>
                  Попробовать снова
                </button>
              </div>
            </div>
          )}
          {pendingArticles.length > 0 && (
            <button
              className="news-feed__new-toast"
              onClick={handleAcceptPending}
              aria-label={`${pendingArticles.length} новых постов`}
            >
              <Icon name="list" size={24} aria-hidden />
              <span className="news-feed__new-toast-count">+{pendingArticles.length}</span>
            </button>
          )}
          <NewsFeed
            articles={filteredArticles}
            loading={loading}
            onLoadMore={hasMore ? loadMore : undefined}
            loadingMore={loadingMore}
            onArticleClick={!channelUsername && !channelId ? handleArticleClick : undefined}
            emptyMessage={!loading && hasActiveFilters
              ? 'Постов не найдено. Измените настройки фильтра.'
              : sourceType === 'youtube'
                ? 'Видео пока нет. Добавьте YouTube-каналы в админке и запустите сбор.'
              : 'Постов пока нет. Добавьте Telegram-каналы в админке и запустите сбор.'}
            onVisibleIndexChange={setVisibleIndex}
            telegramMode={channelUsername ? 'channel-page' : 'channel-list'}
            highlightQuery={filters.search}
            highlightSourceId={highlightSourceId ?? undefined}
            pendingSkeletonCount={pendingSkeletonCount}
            readIds={readIds}
            onArticleRead={handleMarkRead}
          />
        </section>
      </div>

      {!channelUsername && !channelId && (
        <div className={`news-aggregator__sidebar-tab${sidebarOpen ? ' news-aggregator__sidebar-tab--open' : ''}`}>
          <button
            className="news-aggregator__sidebar-btn"
            onClick={e => { e.stopPropagation(); setSidebarOpen(v => !v); }}
            aria-label="Фильтры каналов"
            aria-expanded={sidebarOpen}
          >
            <Icon name={sidebarOpen ? 'x' : 'hamburger'} size={20} />
          </button>
        </div>
      )}

      {!channelUsername && !channelId && (
        <aside
          className={`news-aggregator__sidebar${sidebarOpen ? ' news-aggregator__sidebar--open' : ''}`}
          onClick={e => e.stopPropagation()}
        >
          <div className="news-aggregator__sidebar-header">
            <h3 className="news-aggregator__sidebar-title">Фильтры</h3>
          </div>
          <SocialFilters filters={filters} onChange={handleFiltersChange} onPickerReady={() => setPickerReady(true)} sourceType={sourceType} />
        </aside>
      )}

      {(channelUsername || channelId) && (
        <button
          className="news-pagination__back"
          onClick={() => navigate(sourceType === 'youtube' ? '/youtube' : '/social')}
          title="Вернуться назад"
          aria-label="Вернуться назад"
        >
          <Icon name="arrow-left" size={16} />
        </button>
      )}

      {showNav && (
        <nav className="news-pagination" aria-label="Прокрутка постов">
          <button
            className={`news-pagination__fast news-pagination__fast--up${(atTop || scrollDir !== 'up') ? ' news-pagination__fast--hidden' : ''}`}
            onClick={() => { const el = getScrollEl(); if (el) el.scrollTo({ top: 0, behavior: 'smooth' }); setScrollDir(null); }}
            aria-label="В начало"
          >
            <span className="news-pagination__fast-arrows">
              <span>&#9650;</span>
              <span>&#9650;</span>
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
              onClick={() => setPopupOpen(v => !v)}
              aria-label={`Позиция в ленте: ${displayVisible} из ${feedCount}${total > feedCount ? `, в базе ${total}` : ''}`}
            >
              <span className="news-pagination__info-text">
                {displayVisible}&nbsp;/&nbsp;{feedCount}
              </span>
            </button>
            {popupOpen && (
              <div className="news-pagination__popup">
                <div className="news-pagination__popup-main">
                  {displayVisible}&nbsp;/&nbsp;{feedCount}
                </div>
                {total > feedCount && (
                  <p className="news-pagination__popup-more">
                    В базе по этим фильтрам: {total}. Загружено в ленту (последние): {feedCount}.
                  </p>
                )}
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
              <span>&#9660;</span>
              <span>&#9660;</span>
            </span>
          </button>
        </nav>
      )}
    </div>
  );
};
