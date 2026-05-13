import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { analytics } from '@/services/analytics';
import { newsPath } from '@/utils/slug';
import { Icon } from '@/ui-system/icons/components';

interface PopularArticle {
  articleId: number;
  title: string;
  sourceName: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string;
  region: string;
  category: string;
  clicks: number;
}

interface Props {
  onEmpty: () => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  economy:  <Icon name="chart"   size={20} />,
  tech:     <Icon name="gear"    size={20} />,
  politics: <Icon name="flag"    size={20} />,
  society:  <Icon name="users"   size={20} />,
  other:    <Icon name="book"    size={20} />,
};

const Skeleton: React.FC = () => (
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

export const PopularBlock: React.FC<Props> = ({ onEmpty }) => {
  const [articles, setArticles] = useState<PopularArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const minDelay = new Promise<void>(r => setTimeout(r, 800));
    const fetchData = fetch('/api/news/popular', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => d.articles ?? []);

    Promise.all([fetchData, minDelay])
      .then(([data]) => {
        setArticles(data);
        setLoading(false);
        if (!data.length) {
          const t = setTimeout(onEmpty, 3000);
          return () => clearTimeout(t);
        }
        // небольшая задержка перед появлением карточек — анимация входа
        requestAnimationFrame(() => setVisible(true));
      })
      .catch(() => { setLoading(false); onEmpty(); });
  }, [onEmpty]);

  return (
    <div className="news-popular">
      <div className="news-popular__header">
        <Icon name="fire" size={16} /> Популярное за 24ч
      </div>
      <div className="news-popular__list">
        {loading && [0, 1, 2].map(i => <Skeleton key={i} />)}

        {!loading && articles.length === 0 && (
          <div className="news-popular__empty">
            Пока нет данных о популярных новостях за последние 24ч
          </div>
        )}

        {!loading && articles.map((a, i) => (
          <div
            key={a.articleId}
            className="news-popular__item"
          >
            <div
              className={`news-card news-card--popular${visible ? ' news-card--new' : ''}`}
              style={visible ? { animationDelay: `${i * 120}ms` } : undefined}
            >
              <div className="news-card__body">
                <div className="news-card__image-wrap">
                  {a.imageUrl
                    ? <img className="news-card__image" src={a.imageUrl} alt="" loading="lazy" width={100} height={100} />
                    : (
                      <div className="news-card__image news-card__image--placeholder" aria-hidden>
                        <span className="news-card__image-icon">{CATEGORY_ICONS[a.category] ?? <Icon name="book" size={20} />}</span>
                      </div>
                    )
                  }
                </div>
                <div className="news-card__content">
                  <div className="news-card__meta">
                    <span className="news-card__source">{a.sourceName}</span>
                    <time className="news-card__time" dateTime={a.publishedAt}>
                      {new Date(a.publishedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </time>
                  </div>
                  <h2 className="news-card__title">
                    <Link
                      className="news-card__title-link"
                      href={newsPath(a.articleId, a.title)}
                      onClick={() => analytics.articleClick(a.articleId)}
                    >
                      {a.title}
                    </Link>
                  </h2>
                </div>
              </div>
              <div className="news-card__popular-badge">
                Популярное <span className="news-card__popular-clicks">+{a.clicks}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
