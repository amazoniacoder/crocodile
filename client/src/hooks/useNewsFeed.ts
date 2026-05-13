import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '@/contexts/websocket-context';
import { buildFeedKey, saveFeedSlice, loadFeedSlice, searchOffline } from '@/services/offlineStore';
import type { NewsArticleWithCluster, NewsListResponse, NewsCategory } from '@shared/types/news';
import type { NewsFiltersState } from '../components/news/NewsFilters';

const ARCHIVE_WINDOW_DAYS = 7;
const MAX_ARTICLES_IN_FEED = 500;

const parseIsoDate = (iso: string): Date | null => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const toIsoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const buildArchiveWindow = (selectedDate: string, weekShift: number) => {
  const anchor = parseIsoDate(selectedDate);
  if (!anchor) return null;
  const end = new Date(anchor);
  end.setDate(end.getDate() - weekShift * ARCHIVE_WINDOW_DAYS);
  const start = new Date(end);
  start.setDate(start.getDate() - (ARCHIVE_WINDOW_DAYS - 1));
  return { from: toIsoDate(start), to: toIsoDate(end) };
};

interface UseNewsFeedParams {
  region: 'russia' | 'world' | 'all';
  category?: NewsCategory;
  filters: NewsFiltersState;
  archiveWeekShift: number;
  enabledRegions: { russia: boolean; world: boolean; cities: boolean };
}

interface UseNewsFeedResult {
  articles: NewsArticleWithCluster[];
  total: number;
  loading: boolean;
  error: string | null;
  isOffline: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  pendingArticles: NewsArticleWithCluster[];
  unreadCount: number;
  lastUpdatedLabel: string;
  newIds: Set<number>;
  page: number;
  loadMore(): void;
  acceptPending(onBeforeInsert?: () => void): void;
}

export function useNewsFeed({
  region,
  filters,
  archiveWeekShift,
  enabledRegions,
}: UseNewsFeedParams): UseNewsFeedResult {
  const [articles, setArticles] = useState<NewsArticleWithCluster[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingArticles, setPendingArticles] = useState<NewsArticleWithCluster[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState('');
  const [newIds, setNewIds] = useState<Set<number>>(new Set());

  const prevIdsRef = useRef<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const filtersRef = useRef(filters);
  const enabledRegionsRef = useRef(enabledRegions);
  const hasInitializedRef = useRef(false);
  const { lastMessage } = useWebSocket();
  const lastMessageRef = useRef<any>(null);

  useEffect(() => { filtersRef.current = filters; }, [filters]);
  useEffect(() => { enabledRegionsRef.current = enabledRegions; }, [enabledRegions]);

  const isIncomingAllowed = useCallback((a: NewsArticleWithCluster) => {
    const r = enabledRegionsRef.current;
    if (!r.cities && a.sourceCity) return false;
    if (region === 'russia') return r.russia;
    if (region === 'world') return r.world;
    if (a.region === 'world') return r.world;
    if (a.region === 'russia') return r.russia;
    return true;
  }, [region]);

  // IDB preload при маунте
  useEffect(() => {
    const f = filtersRef.current;
    const canPreload = !f.search.trim() && !f.date && !f.city && archiveWeekShift === 0 && !f.sourceId;
    if (!canPreload) return;
    const feedKey = buildFeedKey({
      region,
      category: f.category === 'all' ? 'all' : (f.category as string[]).join(','),
    });
    loadFeedSlice(feedKey).then(cached => {
      if (!cached || cached.length === 0) return;
      setArticles(cached);
      setTotal(cached.length);
      prevIdsRef.current = new Set(cached.map(a => a.id));
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchNews = useCallback(async (f: NewsFiltersState, markNew = false) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    if (!markNew) { setLoading(true); setError(null); setIsOffline(false); }

    try {
      const params = new URLSearchParams();
      if (f.region !== 'all') params.set('region', f.region);
      if (f.category !== 'all') {
        for (const cat of f.category as string[]) params.append('category', cat);
      }
      if (f.city) params.set('city', f.city);
      params.set('tzOffsetMinutes', String(new Date().getTimezoneOffset()));
      if (f.date) {
        const window = buildArchiveWindow(f.date, archiveWeekShift);
        if (window) {
          params.set('dateFrom', window.from);
          params.set('dateTo', window.to);
        } else {
          params.set('date', f.date);
        }
      }
      params.set('enabledRussia', enabledRegionsRef.current.russia ? '1' : '0');
      params.set('enabledWorld', enabledRegionsRef.current.world ? '1' : '0');
      params.set('enabledCities', enabledRegionsRef.current.cities ? '1' : '0');
      if (f.sourceId) params.set('sourceIds', String(f.sourceId));
      params.set('sourceType', 'rss');
      params.set('page', '1');
      params.set('limit', '50');

      const searchParams = new URLSearchParams();
      searchParams.set('q', f.search.trim());
      searchParams.set('limit', '100');
      searchParams.set('enabledRussia', enabledRegionsRef.current.russia ? '1' : '0');
      searchParams.set('enabledWorld', enabledRegionsRef.current.world ? '1' : '0');
      searchParams.set('enabledCities', enabledRegionsRef.current.cities ? '1' : '0');

      const endpoint = f.search.trim()
        ? `/api/news/search?${searchParams.toString()}`
        : `/api/news?${params}`;

      const res = await fetch(endpoint, { signal: abortRef.current.signal });
      if (!res.ok) throw new Error('Fetch failed');
      const data: NewsListResponse = await res.json();

      if (!f.search.trim() && !markNew) {
        const feedKey = buildFeedKey({
          region: f.region,
          category: f.category === 'all' ? 'all' : (f.category as string[]).join(','),
          city: f.city,
          sourceId: f.sourceId,
        });
        saveFeedSlice(feedKey, data.articles);
        setIsOffline(false);
      }

      if (markNew) {
        const freshAllowed: NewsArticleWithCluster[] = [];
        const acceptedIds = new Set<number>();
        for (const article of data.articles) {
          if (prevIdsRef.current.has(article.id)) continue;
          if (!isIncomingAllowed(article)) continue;
          freshAllowed.push(article);
          acceptedIds.add(article.id);
        }
        if (freshAllowed.length > 0) {
          setUnreadCount(prev => prev + freshAllowed.length);
          setPendingArticles(prev => {
            const existingIds = new Set(prev.map(a => a.id));
            const toAdd = freshAllowed.filter(a => !existingIds.has(a.id));
            return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
          });
        }
        prevIdsRef.current = new Set([...prevIdsRef.current, ...acceptedIds]);
        setTotal(data.total);
      } else {
        const nextArticles = region === 'all' ? data.articles.filter(isIncomingAllowed) : data.articles;
        setArticles(nextArticles);
        setTotal(data.total);
        setPage(1);
        setHasMore(data.hasMore ?? false);
        prevIdsRef.current = new Set(nextArticles.map(a => a.id));
        setLastUpdatedAt(new Date());
        // Сбрасываем скролл после загрузки новых данных
        requestAnimationFrame(() => {
          const feedList = document.querySelector('.news-feed__list') as HTMLElement | null;
          if (feedList) feedList.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        if (f.search.trim()) {
          const cached = await searchOffline(f.search.trim(), 100);
          if (cached.length > 0) {
            setArticles(cached); setTotal(cached.length); setPage(1); setHasMore(false); setLoading(false);
            return;
          }
        } else {
          const feedKey = buildFeedKey({
            region: f.region,
            category: f.category === 'all' ? 'all' : (f.category as string[]).join(','),
            city: f.city,
            sourceId: f.sourceId,
          });
          const cached = await loadFeedSlice(feedKey);
          if (cached) {
            setArticles(cached); setTotal(cached.length); setPage(1); setHasMore(false); setIsOffline(true); setLoading(false);
            return;
          }
        }
        setError('Не удалось загрузить новости. Проверьте соединение и попробуйте ещё раз.');
        setArticles([]); setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  }, [archiveWeekShift, region, isIncomingAllowed]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || articles.length >= MAX_ARTICLES_IN_FEED) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const f = filtersRef.current;
      const params = new URLSearchParams();
      if (f.region !== 'all') params.set('region', f.region);
      if (f.category !== 'all') {
        for (const cat of f.category as string[]) params.append('category', cat);
      }
      if (f.city) params.set('city', f.city);
      params.set('tzOffsetMinutes', String(new Date().getTimezoneOffset()));
      params.set('enabledRussia', enabledRegionsRef.current.russia ? '1' : '0');
      params.set('enabledWorld', enabledRegionsRef.current.world ? '1' : '0');
      params.set('enabledCities', enabledRegionsRef.current.cities ? '1' : '0');
      if (f.sourceId) params.set('sourceIds', String(f.sourceId));
      params.set('sourceType', 'rss');
      params.set('page', String(nextPage));
      params.set('limit', '50');
      const res = await fetch(`/api/news?${params}`);
      if (!res.ok) return;
      const data: NewsListResponse = await res.json();
      setArticles((prev: NewsArticleWithCluster[]) => {
        const existing = new Set(prev.map((a: NewsArticleWithCluster) => a.id));
        const toAdd = data.articles.filter((a: NewsArticleWithCluster) => !existing.has(a.id));
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
      setPage(nextPage);
      setHasMore(data.hasMore ?? false);
    } catch {
      // молча игнорируем
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, articles.length]);

  const fetchNewsRef = useRef(fetchNews);
  useEffect(() => { fetchNewsRef.current = fetchNews; }, [fetchNews]);

  // Стабилизируем filters — сравниваем по значению, чтобы не триггерить эффект
  // при каждом рендере родителя (объект пересоздаётся, но значения те же)
  const filtersKeyRef = useRef('');
  const filtersStableRef = useRef(filters);
  const filtersKey = [
    filters.region, filters.search, filters.date ?? '',
    filters.city ?? '', filters.sourceId ?? '',
    Array.isArray(filters.category) ? filters.category.join(',') : filters.category,
  ].join('|');
  if (filtersKey !== filtersKeyRef.current) {
    filtersKeyRef.current = filtersKey;
    filtersStableRef.current = filters;
  }
  const stableFilters = filtersStableRef.current;

  // Основной эффект — загрузка при смене фильтров/региона
  useEffect(() => {
    const r = enabledRegionsRef.current;
    const isPageDisabled =
      (region === 'russia' && !r.russia) ||
      (region === 'world' && !r.world) ||
      (region === 'all' && !r.russia && !r.world && !r.cities);

    if (isPageDisabled) { setLoading(false); return; }

    const isDefaultQuery =
      stableFilters.search.trim().length === 0 && !stableFilters.date && !stableFilters.city &&
      (stableFilters.category === 'all' || (stableFilters.category as string[]).length === 0);
    const shouldMarkNew =
      !hasInitializedRef.current && region === 'all' && articles.length > 0 && isDefaultQuery;

    hasInitializedRef.current = true;
    fetchNewsRef.current(stableFilters, shouldMarkNew);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, region]);

  // WebSocket → тихое обновление
  useEffect(() => {
    if (!lastMessage || lastMessage === lastMessageRef.current) return;
    lastMessageRef.current = lastMessage;
    fetchNewsRef.current(filtersRef.current, true);
  }, [lastMessage]);

  // Метка времени
  useEffect(() => {
    const update = () => {
      if (!lastUpdatedAt) { setLastUpdatedLabel(''); return; }
      const diff = Math.floor((Date.now() - lastUpdatedAt.getTime()) / 60000);
      setLastUpdatedLabel(diff < 1 ? 'только что' : `${diff} мин назад`);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [lastUpdatedAt]);

  // Сброс unreadCount при фокусе
  useEffect(() => {
    const onFocus = () => setUnreadCount(0);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // PWA Badge
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    if (unreadCount > 0) navigator.setAppBadge(unreadCount);
    else navigator.clearAppBadge();
  }, [unreadCount]);

  const acceptPending = useCallback((onBeforeInsert?: () => void) => {
    if (pendingArticles.length === 0) return;
    onBeforeInsert?.();
    setNewIds(new Set(pendingArticles.map(a => a.id)));
    setTimeout(() => setNewIds(new Set()), 8000);
    setArticles(prev => {
      const existing = new Set(prev.map(a => a.id));
      const toAdd = pendingArticles.filter(a => !existing.has(a.id));
      return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
    });
    setPendingArticles([]);
    setUnreadCount(0);
  }, [pendingArticles]);

  return {
    articles, total, loading, error, isOffline, hasMore, loadingMore,
    pendingArticles, unreadCount, lastUpdatedLabel, newIds, page,
    loadMore, acceptPending,
  };
}
