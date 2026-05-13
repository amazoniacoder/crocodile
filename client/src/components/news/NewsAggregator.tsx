import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearch, useLocation } from 'wouter';
import { NewsFilters } from './NewsFilters';
import { NewsFeed } from './NewsFeed';
import { PopularBlock } from './PopularBlock';
import { TopLikedBlock } from './TopLikedBlock';
import TrendingSidebar from './TrendingSidebar';
import WeatherWidget from '../weather/WeatherWidget';
import { ContactButton, ContactPanel } from '../contact';
import { Icon } from '@/ui-system/icons/components';
import { useEnabledRegions } from '@/contexts/enabled-regions-context';
import { Alert } from '@/ui-system/components/feedback';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { readHistoryApi } from '@/services/myApi';
import type { NewsFiltersState } from './NewsFilters';
import type { NewsCategory } from '../../../../shared/types/news';
import type { ScrollAnchor } from './NewsFeed';
import { useNewsFeed, buildArchiveWindow } from '@/hooks/useNewsFeed';

const SCROLL_SPEED = 8;

type FiltersWithoutRegion = Omit<NewsFiltersState, 'region'>;

const REGION_LABELS: Record<string, string> = {
  russia: 'Россия',
  world: 'Мир',
  all: 'Все новости',
};

const CATEGORY_LABELS: Record<string, string> = {
  economy: 'Экономика',
  tech: 'Технологии',
  politics: 'Политика',
  society: 'Общество',
  other: 'Другое',
  all: '',
};

const DEFAULT_LOCAL: FiltersWithoutRegion = {
  category: 'all',
  city: null,
  date: '',
  search: '',
  sourceId: null,
};

export const NewsAggregator: React.FC<{ region?: 'russia' | 'world' | 'all'; category?: NewsCategory }> = ({
  region: regionProp = 'all',
  category: categoryProp,
}) => {
  const searchStr = useSearch();
  const [, setLocation] = useLocation();

  const initParams = new URLSearchParams(searchStr);
  const initCategories = initParams.getAll('category') as NewsCategory[];
  const [local, setLocal] = useState<FiltersWithoutRegion>({
    category: initCategories.length > 0 ? initCategories : (categoryProp ? [categoryProp] : 'all'),
    city: initParams.get('city') ?? null,
    date: initParams.get('date') ?? '',
    search: initParams.get('q') ?? '',
    sourceId: null,
  });

  const { enabledRegions, disabledSince, setEnabledRegions } = useEnabledRegions();
  const [archiveWeekShift, setArchiveWeekShift] = useState(0);

  const filters: NewsFiltersState = { ...local, region: regionProp };
  const archiveWindow = filters.date ? buildArchiveWindow(filters.date, archiveWeekShift) : null;

  const {
    articles, total, loading, error,
    isOffline,
    hasMore, loadingMore, pendingArticles,
    unreadCount, lastUpdatedLabel, newIds, page,
    loadMore, acceptPending,
  } = useNewsFeed({ region: regionProp, category: categoryProp, filters, archiveWeekShift, enabledRegions });

  // Скелетон — минимум 500мс, независимо от скорости загрузки
  const [skeletonVisible, setSkeletonVisible] = useState(true);
  const skeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loading) {
      // загрузка началась — показываем скелетон
      if (skeletonTimerRef.current) clearTimeout(skeletonTimerRef.current);
      setSkeletonVisible(true);
    } else {
      // загрузка завершилась — скрываем не раньше чем через 500мс
      skeletonTimerRef.current = setTimeout(() => setSkeletonVisible(false), 500);
    }
    return () => {
      if (skeletonTimerRef.current) clearTimeout(skeletonTimerRef.current);
    };
  }, [loading]);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [trendingOpen, setTrendingOpen] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popularOpen, setPopularOpen] = useState(false);
  const [topLikedOpen, setTopLikedOpen] = useState(false);
  const [visibleIndex, setVisibleIndex] = useState(1);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const [scrollDir, setScrollDir] = useState<'up' | 'down' | null>(null);
  const [readIds, setReadIds] = useState<Set<number>>(() => readHistoryApi.getReadIdsSync());

  // Scroll anchor
  const anchorKey = `news:anchor:${regionProp}:${categoryProp ?? 'all'}`;
  const [scrollAnchor, setScrollAnchor] = useState<ScrollAnchor | null>(() => {
    try {
      const raw = sessionStorage.getItem(anchorKey);
      return raw ? (JSON.parse(raw) as ScrollAnchor) : null;
    } catch { return null; }
  });

  const handleAnchorChange = useCallback((anchor: ScrollAnchor) => {
    setScrollAnchor(anchor);
    try { sessionStorage.setItem(anchorKey, JSON.stringify(anchor)); } catch { /* ignore quota */ }
  }, [anchorKey]);

  const feedRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);
  const scrollDirRef = useRef<'up' | 'down' | null>(null);
  const scrollSnapshotRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);
  const enabledRegionsRef = useRef(enabledRegions);
  const disabledSinceRef = useRef(disabledSince);
  const filtersRef = useRef(filters);

  useEffect(() => { enabledRegionsRef.current = enabledRegions; }, [enabledRegions]);
  useEffect(() => { disabledSinceRef.current = disabledSince; }, [disabledSince]);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  const getScrollEl = (): HTMLElement | null =>
    (feedRef.current?.querySelector('.news-feed__list') as HTMLElement) ?? null;

  // Восстанавливаем scrollTop после вставки pending сверху
  useEffect(() => {
    const snap = scrollSnapshotRef.current;
    if (!snap) return;
    scrollSnapshotRef.current = null;
    const el = getScrollEl();
    if (el) el.scrollTop = snap.scrollTop;
  }, [articles]);

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

  // Сброс фильтров при смене региона/категории
  const prevRegionRef = useRef(regionProp);
  const prevCategoryRef = useRef(categoryProp);
  useEffect(() => {
    const regionChanged = prevRegionRef.current !== regionProp;
    const categoryChanged = prevCategoryRef.current !== categoryProp;
    if (!regionChanged && !categoryChanged) return;
    prevRegionRef.current = regionProp;
    prevCategoryRef.current = categoryProp;
    setLocal({ ...DEFAULT_LOCAL, category: categoryProp ? [categoryProp] : 'all' });
    setLocation(window.location.pathname, { replace: true });
  }, [regionProp, categoryProp]);

  const [pendingSkeletonCount, setPendingSkeletonCount] = useState(0);
  const pendingSkeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAcceptPending = () => {
    const count = pendingArticles.length;
    if (!count) return;
    const el = getScrollEl();
    const savedScrollTop = el ? el.scrollTop : 0;
    const ESTIMATE = 220;
    // Показываем скелетоны, через 500мс вставляем реальные карточки
    setPendingSkeletonCount(count);
    if (pendingSkeletonTimerRef.current) clearTimeout(pendingSkeletonTimerRef.current);
    pendingSkeletonTimerRef.current = setTimeout(() => {
      setPendingSkeletonCount(0);
      acceptPending(() => {
        if (el && savedScrollTop > 0) {
          scrollSnapshotRef.current = {
            scrollTop: savedScrollTop + count * ESTIMATE,
            scrollHeight: el.scrollHeight,
          };
        }
      });
    }, 500);
  };

  const handleFiltersChange = (f: NewsFiltersState) => {
    setScrollAnchor(null);
    try { sessionStorage.removeItem(anchorKey); } catch { /* ignore */ }
    if (f.date !== filtersRef.current.date) setArchiveWeekShift(0);
    const p = new URLSearchParams();
    if (f.category && f.category !== 'all') {
      for (const cat of f.category as string[]) p.append('category', cat);
    }
    if (f.city) p.set('city', f.city);
    if (f.date) p.set('date', f.date);
    if (f.search.trim()) p.set('q', f.search.trim());
    const qs = p.toString();
    setLocation(qs ? `?${qs}` : window.location.pathname, { replace: true });
    const { region: _, ...rest } = f;
    setLocal(rest);
  };

  const handleArchiveWindowShift = (direction: 'older' | 'newer') => {
    setArchiveWeekShift(current => direction === 'older' ? current + 1 : Math.max(0, current - 1));
  };

  const handleEnabledRegionsChange = (next: { russia: boolean; world: boolean; cities: boolean }) => {
    setEnabledRegions(next);
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

  const feedCount = articles.length;
  const loadedCount = articles.length;

  const hasGate =
    (regionProp === 'all' && (!enabledRegions.russia || !enabledRegions.world || !enabledRegions.cities)) ||
    (regionProp === 'russia' && (!enabledRegions.russia || !enabledRegions.cities)) ||
    (regionProp === 'world' && (!enabledRegions.world || !enabledRegions.cities));

  const isFeedDisabled =
    (regionProp === 'all' && (!enabledRegions.russia && !enabledRegions.world && !enabledRegions.cities)) ||
    (regionProp === 'russia' && !enabledRegions.russia) ||
    (regionProp === 'world' && !enabledRegions.world);

  useEffect(() => {
    if (feedCount === 0) { setVisibleIndex(1); return; }
    setVisibleIndex(v => Math.min(Math.max(1, v), feedCount));
  }, [feedCount]);

  const displayVisible = feedCount === 0 ? 0 : Math.min(Math.max(1, visibleIndex), feedCount);

  const regionLabel = REGION_LABELS[regionProp] ?? 'Новости';
  const categoryLabel = local.category === 'all' || (local.category as string[]).length === 0
    ? ''
    : (local.category as string[]).map(c => CATEGORY_LABELS[c] ?? c).join(', ');
  const pageTitle = categoryLabel
    ? `${categoryLabel} — ${regionLabel} | Crocodile`
    : `${regionLabel} | Crocodile`;
  const pageDescription = categoryLabel
    ? `Последние новости: ${categoryLabel.toLowerCase()}, ${regionLabel.toLowerCase()}. Без алгоритмов — только проверенные источники.`
    : `Последние новости — ${regionLabel.toLowerCase()}. Без алгоритмов — только проверенные источники.`;

  const showNav = feedCount > 0 && !loading;

  useEffect(() => {
    readHistoryApi.getReadIds().then(setReadIds).catch(() => {});
    readHistoryApi.gc().catch(() => {});
  }, []);

  return (
    <>
      <Helmet>
        <title>{unreadCount > 0 ? `(${unreadCount}) ${pageTitle}` : pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="website" />
      </Helmet>

      <div
        className="news-aggregator"
        onClick={() => {
          if (sidebarOpen) setSidebarOpen(false);
          if (trendingOpen) setTrendingOpen(false);
          if (weatherOpen) setWeatherOpen(false);
          if (contactOpen) setContactOpen(false);
          if (popupOpen) setPopupOpen(false);
        }}
      >
        <div className="news-aggregator__body" ref={feedRef}>
          <section className="news-aggregator__feed">
            <button
              className={`news-popular__trigger${popularOpen ? ' news-popular__trigger--active' : ''}`}
              onClick={() => { setPopularOpen(v => !v); setTopLikedOpen(false); }}
              aria-label="Популярные новости"
              title="Популярные новости"
            >
              {popularOpen
                ? <Icon name="x" size={18} />
                : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                )
              }
            </button>
            <button
              className={`news-popular__trigger news-popular__trigger--liked${topLikedOpen ? ' news-popular__trigger--active' : ''}`}
              onClick={() => { setTopLikedOpen(v => !v); setPopularOpen(false); }}
              aria-label="Топ лайков"
              title="Топ лайков"
            >
              {topLikedOpen
                ? <Icon name="x" size={18} />
                : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
                    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                  </svg>
                )
              }
            </button>

            <p className="news-feed__updated">{lastUpdatedLabel ? `Обновлено: ${lastUpdatedLabel}` : ''}</p>

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

            {popularOpen && (
              <ErrorBoundary level="component">
                <PopularBlock onEmpty={() => setPopularOpen(false)} />
              </ErrorBoundary>
            )}
            {topLikedOpen && (
              <ErrorBoundary level="component">
                <TopLikedBlock onEmpty={() => setTopLikedOpen(false)} />
              </ErrorBoundary>
            )}

            {hasGate && (
              <div style={{ padding: '0 16px' }}>
                <Alert
                  variant={isFeedDisabled ? 'warning' : 'info'}
                  title={isFeedDisabled ? 'Лента отключена' : 'Лента обновляется с фильтрами'}
                  message={
                    isFeedDisabled
                      ? (regionProp === 'russia'
                        ? 'Включите переключатель "Россия", чтобы принимать новые новости этого региона.'
                        : regionProp === 'world'
                          ? 'Включите переключатель "Мир", чтобы принимать новые новости этого региона.'
                          : 'Включите хотя бы один переключатель в фильтре (Россия / Мир / Города), чтобы принимать новые новости.')
                      : 'Новые новости из выключенных разделов не добавляются. Уже показанные карточки остаются в ленте.'
                  }
                />
              </div>
            )}

            <ErrorBoundary level="section">
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
              <NewsFeed
                articles={articles}
                loading={loading}
                error={error}
                newIds={newIds}
                highlightQuery={filters.search}
                onVisibleIndexChange={setVisibleIndex}
                onLoadMore={hasMore ? loadMore : undefined}
                loadingMore={loadingMore}
                scrollAnchor={scrollAnchor}
                onAnchorChange={handleAnchorChange}
                pendingSkeletonCount={pendingSkeletonCount}
                readIds={readIds}
                onArticleRead={handleMarkRead}
              />
            </ErrorBoundary>
          </section>
        </div>

        {showNav && (
          <nav className="news-pagination" aria-label="Прокрутка новостей">
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
                aria-label={`Позиция в ленте: ${displayVisible} из ${feedCount}${total > loadedCount ? `, в базе ${total}` : ''}`}
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
                  {total > loadedCount && (
                    <p className="news-pagination__popup-more">
                      В базе по этим фильтрам: {total}. Загружено в ленту (последние): {loadedCount}.
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

        <div className={`news-aggregator__trending-tab${trendingOpen ? ' news-aggregator__trending-tab--open' : ''}`}>
          <button
            className="news-aggregator__trending-btn"
            onClick={(e) => { e.stopPropagation(); setTrendingOpen(v => !v); }}
            aria-label="В тренде"
            aria-expanded={trendingOpen}
          >
            <Icon name={trendingOpen ? 'x' : 'trophy'} size={20} />
          </button>
        </div>

        <div className={`news-aggregator__weather-tab${weatherOpen ? ' news-aggregator__weather-tab--open' : ''}`}>
          <button
            className="news-aggregator__weather-btn"
            onClick={(e) => { e.stopPropagation(); setWeatherOpen(v => !v); setTrendingOpen(false); }}
            aria-label="Погода"
            aria-expanded={weatherOpen}
          >
            <Icon name={weatherOpen ? 'x' : 'sun'} size={20} />
          </button>
        </div>

        <ErrorBoundary level="component">
          <TrendingSidebar open={trendingOpen} onClose={() => setTrendingOpen(false)} />
        </ErrorBoundary>

        <ErrorBoundary level="component">
          <WeatherWidget open={weatherOpen} onClose={() => setWeatherOpen(false)} />
        </ErrorBoundary>

        <div className={`news-aggregator__sidebar-tab${sidebarOpen ? ' news-aggregator__sidebar-tab--open' : ''}`}>
          <button
            className="news-aggregator__sidebar-btn"
            onClick={(e) => { e.stopPropagation(); setSidebarOpen(v => !v); }}
            aria-label="Фильтры новостей"
            aria-expanded={sidebarOpen}
          >
            <Icon name={sidebarOpen ? 'x' : 'hamburger'} size={20} />
          </button>
        </div>

        <ContactButton
          onClick={(e) => { e.stopPropagation(); setContactOpen(v => !v); }}
          isOpen={contactOpen}
        />

        <aside
          className={`news-aggregator__sidebar${sidebarOpen ? ' news-aggregator__sidebar--open' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="news-aggregator__sidebar-header">
            <h3 className="news-aggregator__sidebar-title">Фильтры</h3>
          </div>
          <ErrorBoundary level="section">
            <NewsFilters
              filters={filters}
              onChange={handleFiltersChange}
              archiveWindowLabel={archiveWindow ? `${archiveWindow.from} — ${archiveWindow.to}` : null}
              onArchiveWindowShift={handleArchiveWindowShift}
              enabledRegions={enabledRegions}
              onEnabledRegionsChange={handleEnabledRegionsChange}
            />
          </ErrorBoundary>
        </aside>

        <ErrorBoundary level="component">
          <ContactPanel
            isOpen={contactOpen}
            onClose={() => setContactOpen(false)}
          />
        </ErrorBoundary>
      </div>
    </>
  );
};
