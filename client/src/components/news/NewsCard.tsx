import React, { useState } from 'react';
import { Link } from 'wouter';
import { NewsCluster } from './NewsCluster';
import { ArticleReactions } from './ArticleReactions';
import type { NewsArticleWithCluster } from '../../../../shared/types/news';
import { newsPath } from '@/utils/slug';
import { TelegramEmbed } from './TelegramEmbed';
import { YouTubeEmbed } from './YouTubeEmbed';
import { Modal } from '@/ui-system/components/modal/Modal';
import { Icon } from '@/ui-system/icons/components';

interface NewsCardProps {
  article: NewsArticleWithCluster;
  index?: number;
  isNew?: boolean;
  newIndex?: number;
  highlightQuery?: string;
  highlightSourceId?: number;
  onArticleClick?: (article: NewsArticleWithCluster) => void;
  onArticleRead?: (articleId: number) => void;
  telegramMode?: 'channel-list' | 'channel-page' | 'personal-list';
  isBookmarked?: boolean;
  onBookmark?: (articleId: number) => void;
  isRead?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  economy: 'Экономика',
  tech: 'Технологии',
  politics: 'Политика',
  society: 'Общество',
  other: 'Другое',
};

const CATEGORY_ICONS: Record<string, string> = {
  economy: '💹',
  tech: '💻',
  politics: '🏦',
  society: '👥',
  other: '📰',
};

const REGION_LABELS: Record<string, { label: string; href: string }> = {
  russia: { label: 'Россия', href: '/russia' },
  world:  { label: 'Мир',    href: '/world' },
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightText = (text: string, query?: string): React.ReactNode => {
  const q = query?.trim();
  if (!q || q.length < 2) return text;

  const safe = escapeRegExp(q);
  const regex = new RegExp(`(${safe})`, 'ig');
  const parts = text.split(regex);
  if (parts.length === 1) return text;

  return parts.map((part, idx) =>
    part.toLowerCase() === q.toLowerCase()
      ? <mark key={`${part}-${idx}`} className="news-card__highlight">{part}</mark>
      : <React.Fragment key={`${part}-${idx}`}>{part}</React.Fragment>
  );
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 60) return `${diffMin} мин назад`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)} ч назад`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

const useRelativeTime = (iso: string): string => {
  const [label, setLabel] = React.useState(() => formatTime(iso));
  React.useEffect(() => {
    setLabel(formatTime(iso));
    const id = setInterval(() => setLabel(formatTime(iso)), 60000);
    return () => clearInterval(id);
  }, [iso]);
  return label;
};

const parseMediaUrl = (raw: string | null): { url: string; isVideo: boolean } | null => {
  if (!raw) return null;
  if (raw.startsWith('video:')) return { url: raw.slice(6), isVideo: true };
  return { url: raw, isVideo: false };
};

const NewsCardImage: React.FC<{ src: string | null; category: string; logoUrl?: string | null }> = ({ src, category, logoUrl }) => {
  const media = parseMediaUrl(src);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(media ? 'loading' : 'error');

  React.useEffect(() => {
    if (!media || status !== 'loading') return;
    const t = setTimeout(() => setStatus('error'), 8000);
    return () => clearTimeout(t);
  }, [media?.url, status]);

  if (status === 'error' || !media) {
    if (logoUrl) {
      return (
        <div className="news-card__image-wrap">
          <img
            className="news-card__image news-card__image--logo"
            src={logoUrl}
            alt=""
            loading="lazy"
            width={100}
            height={100}
          />
        </div>
      );
    }
    return (
      <div className="news-card__image news-card__image--placeholder" aria-hidden>
        <span className="news-card__image-icon">{CATEGORY_ICONS[category] ?? '📰'}</span>
      </div>
    );
  }

  if (media.isVideo) {
    return (
      <div className="news-card__image news-card__image--placeholder news-card__image--video" aria-hidden>
        <span className="news-card__image-icon">▶️</span>
      </div>
    );
  }

  return (
    <div className="news-card__image-wrap">
      {status === 'loading' && <div className="news-card__image news-card__image--skeleton" aria-hidden />}
      <img
        className={`news-card__image${status === 'loaded' ? '' : ' news-card__image--hidden'}`}
        src={media.url}
        alt=""
        loading="lazy"
        width={100}
        height={100}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
      />
    </div>
  );
};

export const NewsCard: React.FC<NewsCardProps> = ({ article, index = 0, isNew = false, newIndex = 0, highlightQuery, highlightSourceId, onArticleClick, onArticleRead, telegramMode, isBookmarked, onBookmark, isRead }) => {
  const relativeTime = useRelativeTime(article.publishedAt);
  const [phase, setPhase] = React.useState<'skeleton' | 'content'>(isNew ? 'skeleton' : 'content');
  const [embedOpen, setEmbedOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isNew) return;
    const delay = Math.min(newIndex * 200, 1600) + 2000;
    const t = setTimeout(() => setPhase('content'), delay);
    return () => clearTimeout(t);
  }, [isNew, newIndex]);

  const isCluster = !!article.cluster && article.cluster.articleCount > 1;
  const region = REGION_LABELS[article.region];
  const isTelegram = (article as any).sourceType === 'telegram';
  const isYouTube = (article as any).sourceType === 'youtube';
  const channelUsername = (article as any).channelUsername as string | null;
  const channelId = (article as any).sourceChannelId as string | null;
  const messageId = (article as any).messageId as number | null;
  const videoId = (article as any).videoId as string | null;
  const sourceId = (article as any).sourceId as number | undefined;
  const isHighlighted = highlightSourceId !== undefined && sourceId === highlightSourceId;

  const sourceLogoUrl = (article as any).sourceLogoUrl as string | null;

  const mediaType: 'image' | 'video' | 'none' = (() => {
    if (article.imageUrl?.startsWith('video:')) return 'video';
    if (article.imageUrl) return 'image';
    // fallback: определяем по эмодзи в заголовке
    if (/\u{1F3AC}|\u{1F4F9}|\u{25B6}|\u{1F39E}/u.test(article.title)) return 'video';
    if (/\u{1F4F7}|\u{1F5BC}|\u{1F4F8}|\u{1F4F0}/u.test(article.title)) return 'image';
    return 'none';
  })();

  if (phase === 'skeleton') {
    return (
      <div className="news-card__new-skeleton" aria-hidden="true">
        <div className="news-card__new-skeleton-image" />
        <div className="news-card__new-skeleton-body">
          <div className="news-card__new-skeleton-meta" />
          <div className="news-card__new-skeleton-title" />
          <div className="news-card__new-skeleton-title news-card__new-skeleton-title--short" />
          <div className="news-card__new-skeleton-desc" />
        </div>
      </div>
    );
  }

  return (
    <article
      className={`news-card${isCluster ? ' news-card--cluster' : ''}${isNew ? ' news-card--new' : ''}${isTelegram ? ' news-card--telegram' : ''}${isYouTube ? ' news-card--youtube' : ''}${(isYouTube || isTelegram) && embedOpen ? ' news-card--expanded' : ''}${isRead ? ' news-card--read' : ''}`}
      onClick={onArticleClick ? () => onArticleClick(article) : undefined}
      data-article-id={article.id}
    >
      <div className="news-card__body">
        <NewsCardImage src={article.imageUrl} category={article.category} logoUrl={sourceLogoUrl} />

        <div className="news-card__content">
          <div className="news-card__meta">
            <span className={`news-card__source${isHighlighted ? ' news-card__source--highlighted' : ''}`}>
              {article.sourceName}
            </span>
            {isTelegram && (
              <span className="news-card__telegram-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.667l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.978.892z"/>
                </svg>
                Telegram
              </span>
            )}
            {isYouTube && (
              <span className="news-card__youtube-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/>
                </svg>
                YouTube
              </span>
            )}
            {region && !isTelegram && (
              <Link href={region.href} className="news-card__region">
                {region.label}
              </Link>
            )}
            <span className="news-card__category">
              {CATEGORY_LABELS[article.category] ?? article.category}
            </span>
            <time className="news-card__time" dateTime={article.publishedAt}>
              {relativeTime}
            </time>
          </div>

          <h2 className="news-card__title">
            {telegramMode === 'personal-list' && channelUsername ? (
              <Link
                className="news-card__title-link"
                href={`/my/telegram/${channelUsername}`}
                onClick={e => e.stopPropagation()}
              >
                {highlightText(article.title, highlightQuery)}
              </Link>
            ) : telegramMode === 'personal-list' && isYouTube && channelId ? (
              <Link
                className="news-card__title-link"
                href={`/my/youtube/${channelId}`}
                onClick={e => e.stopPropagation()}
              >
                {highlightText(article.title, highlightQuery)}
              </Link>
            ) : telegramMode === 'channel-list' && channelUsername ? (
              <Link
                className="news-card__title-link"
                href={`/social/channel/${channelUsername}?scrollTo=${article.id}`}
                onClick={e => e.stopPropagation()}
              >
                {highlightText(article.title, highlightQuery)}
              </Link>
            ) : telegramMode === 'channel-page' && channelUsername && messageId ? (
              <a
                className="news-card__title-link"
                href={`https://t.me/${channelUsername}/${messageId}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
              >
                {highlightText(article.title, highlightQuery)}
              </a>
            ) : (
              <Link
                className="news-card__title-link"
                href={newsPath(article.id, article.title)}
              >
                {highlightText(article.title, highlightQuery)}
              </Link>
            )}
          </h2>

          {article.description && (
            <p className="news-card__description">{highlightText(article.description, highlightQuery)}</p>
          )}

          {isTelegram && channelUsername && messageId && embedOpen && (
            <Modal
              isOpen={embedOpen}
              onClose={(e?: React.MouseEvent | KeyboardEvent) => {
                if (e instanceof MouseEvent) e.stopPropagation();
                setEmbedOpen(false);
              }}
              size="full"
              title={article.sourceName}
              closeOnBackdropClick
              closeOnEscape
            >
              <TelegramEmbed username={channelUsername} messageId={messageId} open={embedOpen} />
            </Modal>
          )}

          {isYouTube && videoId && embedOpen && (
            <YouTubeEmbed videoId={videoId} open={embedOpen} />
          )}
        </div>
      </div>

      {isCluster && (
        <NewsCluster articles={article.clusterArticles ?? []} />
      )}
      <div className="news-card__footer">
        {onBookmark && (
          <button
            className={`news-card__bookmark${isBookmarked ? ' news-card__bookmark--active' : ''}`}
            onClick={e => { e.stopPropagation(); onBookmark(article.id); }}
            aria-label={isBookmarked ? 'Удалить из закладок' : 'Добавить в закладки'}
            title={isBookmarked ? 'Удалить из закладок' : 'Добавить в закладки'}
          >
            🔖
          </button>
        )}
        {!isTelegram && !isYouTube && (
          <ArticleReactions
            key={article.id}
            articleId={article.id}
            showEmotions={false}
          />
        )}
        {isTelegram && channelUsername && messageId && (
          <div className="tg-embed__actions" onClick={e => e.stopPropagation()}>
            <button
              className={`tg-embed__action-btn${embedOpen ? ' tg-embed__action-btn--secondary' : ' tg-embed__action-btn--primary'}`}
              onClick={() => {
                if (!embedOpen && onArticleRead) onArticleRead(article.id);
                setEmbedOpen(v => !v);
              }}
            >
              <Icon name={mediaType === 'video' ? 'video' : mediaType === 'image' ? 'image' : 'file'} size={15} />
              {embedOpen ? 'Закрыть пост' : 'Открыть пост'}
            </button>
            <a
              className="tg-embed__action-btn tg-embed__action-btn--primary"
              href={`https://t.me/${channelUsername}/${messageId}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { if (onArticleRead) onArticleRead(article.id); }}
            >
              Читать далее
            </a>
          </div>
        )}
        {isYouTube && videoId && (
          <div className="tg-embed__actions" onClick={e => e.stopPropagation()}>
            <button
              className={`tg-embed__action-btn${embedOpen ? ' tg-embed__action-btn--secondary' : ' tg-embed__action-btn--primary'}`}
              onClick={() => {
                if (!embedOpen && onArticleRead) onArticleRead(article.id);
                setEmbedOpen(v => !v);
              }}
            >
              <Icon name="video" size={15} />
              {embedOpen ? 'Скрыть видео' : 'Смотреть видео'}
            </button>
            <a
              className="tg-embed__action-btn tg-embed__action-btn--primary"
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { if (onArticleRead) onArticleRead(article.id); }}
            >
              На YouTube
            </a>
          </div>
        )}
      </div>
      {isRead && (
        <div className="news-card__read-badge">
          ПРОСМОТРЕНО
        </div>
      )}
    </article>
  );
};
