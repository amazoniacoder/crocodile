import React, { useRef, useEffect, useCallback, useState } from 'react';
import { NewsCard } from './NewsCard';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Alert } from '@/ui-system/components/feedback';
import type { NewsArticleWithCluster } from '../../../../shared/types/news';

function FeedSkeleton() {
  return (
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
  );
}

function PendingSkeleton({ count }: { count: number }) {
  return (
    <div className="news-feed__pending-skeletons" aria-hidden="true">
      {Array.from({ length: Math.min(count, 6) }).map((_, i) => (
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
  );
}

export interface ScrollAnchor {
  articleId: number;
  offset: number;
}

interface NewsFeedProps {
  articles: NewsArticleWithCluster[];
  loading: boolean;
  error?: string | null;
  newIds?: Set<number>;
  readIds?: Set<number>;
  onArticleRead?: (articleId: number) => void;
  highlightQuery?: string;
  highlightSourceId?: number;
  onVisibleIndexChange?: (index: number) => void;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  scrollAnchor?: ScrollAnchor | null;
  onAnchorChange?: (anchor: ScrollAnchor) => void;
  onArticleClick?: (article: NewsArticleWithCluster) => void;
  emptyMessage?: string;
  telegramMode?: 'channel-list' | 'channel-page' | 'personal-list';
  pendingSkeletonCount?: number;
  bookmarkedIds?: Set<number>;
  onBookmark?: (articleId: number) => void;
}

export const NewsFeed: React.FC<NewsFeedProps> = ({ articles, loading, error, newIds, readIds, onArticleRead, highlightQuery, highlightSourceId, onVisibleIndexChange, onLoadMore, loadingMore, scrollAnchor, onAnchorChange, onArticleClick, emptyMessage, telegramMode, pendingSkeletonCount = 0, bookmarkedIds, onBookmark }) => {
  const [showEmpty, setShowEmpty] = useState(false);
  const emptyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loading && !error && articles.length === 0) {
      emptyTimerRef.current = setTimeout(() => setShowEmpty(true), 300);
    } else {
      setShowEmpty(false);
      if (emptyTimerRef.current) clearTimeout(emptyTimerRef.current);
    }
    return () => { if (emptyTimerRef.current) clearTimeout(emptyTimerRef.current); };
  }, [loading, error, articles.length]);

  const listRef = useRef<HTMLDivElement>(null);
  const anchorRestoredRef = useRef(false);
  const virtualizer = useVirtualizer({
    count: articles.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 176,
    overscan: 6,
    measureElement: (element) => {
      const styles = window.getComputedStyle(element);
      const mt = Number.parseFloat(styles.marginTop) || 0;
      const mb = Number.parseFloat(styles.marginBottom) || 0;
      return element.getBoundingClientRect().height + mt + mb;
    },
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Восстанавливаем позицию по якорю (id статьи + offset) один раз после маунта
  useEffect(() => {
    if (anchorRestoredRef.current || !scrollAnchor || !articles.length) return;
    const idx = articles.findIndex((a) => a.id === scrollAnchor.articleId);
    if (idx === -1) return;
    anchorRestoredRef.current = true;
    virtualizer.scrollToIndex(idx, { align: 'start' });
    // Применяем offset после того как virtualizer отрисует позицию
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop += scrollAnchor.offset;
    });
  }, [articles.length, scrollAnchor, virtualizer]);

  // Сохраняем якорь при скролле
  const onScroll = useCallback(() => {
    if (!onAnchorChange || !articles.length) return;
    const el = listRef.current;
    if (!el) return;
    const firstItem = virtualizer.getVirtualItems()[0];
    if (!firstItem) return;
    const article = articles[firstItem.index];
    if (!article) return;
    const offset = el.scrollTop - firstItem.start;
    onAnchorChange({ articleId: article.id, offset });
  }, [articles, onAnchorChange, virtualizer]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  useEffect(() => {
    if (!onVisibleIndexChange || !articles.length) return;
    const firstVisible = virtualItems[0];
    if (!firstVisible) return;
    onVisibleIndexChange(firstVisible.index + 1);
  }, [articles.length, onVisibleIndexChange, virtualizer]);

  const loadMoreCalledRef = useRef(false);
  const prevArticlesLengthRef = useRef(articles.length);

  // Триггер подгрузки когда до конца осталось 5 элементов
  useEffect(() => {
    // Новые статьи пришли — разрешаем следующий вызов
    if (articles.length > prevArticlesLengthRef.current) {
      loadMoreCalledRef.current = false;
    }
    prevArticlesLengthRef.current = articles.length;
  }, [articles.length]);

  useEffect(() => {
    if (!onLoadMore || !articles.length) return;
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;
    if (lastItem.index >= articles.length - 5) {
      if (!loadMoreCalledRef.current) {
        loadMoreCalledRef.current = true;
        onLoadMore();
      }
    }
  }, [virtualItems, articles.length, onLoadMore]);

  return (
    <div className="news-feed">
      <div className="news-feed__list" ref={listRef}>
        {loading && !articles.length && <FeedSkeleton />}

        {!loading && !!error && !articles.length && (
          <div className="news-feed__empty" aria-live="polite">
            <Alert
              variant="error"
              title="Ошибка загрузки новостей"
              message={error}
            />
          </div>
        )}

        {!loading && !error && !articles.length && showEmpty && (
          <div className="news-feed__empty" aria-live="polite">
            <p>{emptyMessage ?? 'Новостей не найдено. Попробуйте изменить фильтры.'}</p>
          </div>
        )}

        {pendingSkeletonCount > 0 && (
          <div
            className="news-feed__pending-overlay"
            style={{
              top: listRef.current ? listRef.current.scrollTop + 15 : 15,
              height: `${Math.min(pendingSkeletonCount, 6) * 216}px`
            }}
          >
            <PendingSkeleton count={pendingSkeletonCount} />
          </div>
        )}

        {!loading && (() => {
          const newOrder = new Map<number, number>();
          let idx = 0;
          for (const a of articles) {
            if (newIds?.has(a.id)) newOrder.set(a.id, idx++);
          }

          return (
            <div
              className="news-feed__virtual news-feed__virtual--loaded"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualItems.map((item) => {
                const article = articles[item.index];
                if (!article) return null;
                return (
                  <div
                    key={item.key}
                    data-index={item.index}
                    ref={virtualizer.measureElement}
                    className="news-feed__virtual-item"
                    style={{ transform: `translateY(${item.start}px)` }}
                  >
                    <NewsCard
                      article={article}
                      index={item.index}
                      isNew={newIds?.has(article.id) ?? false}
                      newIndex={newOrder.get(article.id) ?? 0}
                      highlightQuery={highlightQuery}
                      highlightSourceId={highlightSourceId}
                      onArticleClick={onArticleClick}
                      onArticleRead={onArticleRead}
                      telegramMode={telegramMode}
                      isBookmarked={bookmarkedIds?.has(article.id)}
                      onBookmark={onBookmark}
                      isRead={readIds?.has(article.id)}
                    />
                  </div>
                );
              })}
            </div>
          );
        })()}
        {loadingMore && (
          <div className="news-feed__load-more">
            <div className="news-feed__load-more-spinner" />
          </div>
        )}
      </div>
    </div>
  );
};
