import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useLocation } from 'wouter';
import { Helmet } from 'react-helmet-async';
import { Spinner, Alert } from '@/ui-system/components/feedback';
import { NewsCard } from '@/components/news/NewsCard';
import { ArticleReactions } from '@/components/news/ArticleReactions';
import { Icon } from '@/ui-system/icons/components';
import { analytics } from '@/services/analytics';
import { newsPath, slugify } from '@/utils/slug';
import { saveArticleDetail, loadArticleDetail } from '@/services/offlineStore';
import { db } from '@/services/db';
import { useShare } from '@/hooks/useShare';
import type { NewsDetailResponse, NewsArticle, NewsArticleWithCluster } from '../../../shared/types/news';

const CATEGORY_LABELS: Record<string, string> = {
  economy: 'Экономика',
  tech: 'Технологии',
  politics: 'Политика',
  society: 'Общество',
  other: 'Другое',
};

const asCardArticle = (a: NewsArticle): NewsArticleWithCluster => ({
  ...a,
  cluster: null,
  clusterArticles: [],
});

const NewsDetailPage: React.FC = () => {
  const { id, slug } = useParams<{ id: string; slug?: string }>();
  const [, setLocation] = useLocation();
  const numericId = useMemo(() => Number.parseInt(id ?? '', 10), [id]);
  const { share, status: shareStatus } = useShare();

  const [data, setData] = useState<NewsDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setError('Некорректный идентификатор новости.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/news/${numericId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('not_ok');
        return (await res.json()) as NewsDetailResponse;
      })
      .then((payload) => {
        if (cancelled) return;
        saveArticleDetail(numericId, payload);
        setData(payload);

        const canonical = newsPath(payload.article.id, payload.article.title);
        const currentSlug = (slug ?? '').trim();
        const canonicalSlug = slugify(payload.article.title);
        const needsUpdate = canonicalSlug && currentSlug !== canonicalSlug;
        if (needsUpdate) {
          setLocation(canonical, { replace: true });
        }
      })
      .catch(async () => {
        // Читаем IDB до проверки cancelled — компонент может размонтироваться пока идёт async-запрос
        const cached = await loadArticleDetail(numericId);
        if (!cached) {
          // Фаллбэк: статья есть в IDB после загрузки ленты
          const fromFeed = await db.articles.get(numericId);
          if (fromFeed && !cancelled) {
            setData({
              article: fromFeed as unknown as NewsArticle,
              clusterSources: [],
              similarArticles: [],
              otherArticles: [],
            });
            setLoading(false);
            return;
          }
        }
        if (cancelled) return;
        if (cached) {
          setData(cached);
        } else {
          setError('Не удалось загрузить новость. Попробуйте обновить страницу.');
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [numericId]);

  if (loading) {
    return (
      <div className="news-detail">
        <div className="news-detail__wrap">
          <div className="news-detail__center"><Spinner size="lg" /></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="news-detail">
        <div className="news-detail__wrap">
          <Alert
            variant="error"
            title="Ошибка"
            message={error ?? 'Новость не найдена.'}
          />
          <div style={{ marginTop: 16 }}>
            <Link href="/" className="button button--primary">На главную</Link>
          </div>
        </div>
      </div>
    );
  }

  const { article, clusterSources, similarArticles, otherArticles } = data;
  const title = `${article.title} | Crocodile`;
  const description = (article.description ?? '').slice(0, 220) || 'Новости без алгоритмов — только проверенные источники.';
  const canonicalPath = newsPath(article.id, article.title);
  const canonicalUrl = (typeof window !== 'undefined' ? window.location.origin : '') + canonicalPath;

  return (
    <div className="news-detail">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={canonicalUrl} />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <div className="news-detail__wrap">
        <article className="news-card news-card--detail news-detail__hero">
          <div className="news-card__body">
            <div className="news-card__content" style={{ width: '100%' }}>
              <div className="news-card__meta">
                <span className="news-card__source">{article.sourceName}</span>
                <span className="news-card__category">{CATEGORY_LABELS[article.category] ?? article.category}</span>
                <time className="news-card__time" dateTime={article.publishedAt}>
                  {new Date(article.publishedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>

              <h1 className="news-card__title">{article.title}</h1>

              {article.description && (
                <p className="news-detail__description">{article.description}</p>
              )}

              <div className="news-detail__actions">
                <div className="news-detail__emotions">
                  <ArticleReactions articleId={article.id} showVotes={false} />
                </div>
                <button
                  className="button button--icon"
                  type="button"
                  onClick={() => share({ title: article.title, url: window.location.href })}
                  title={shareStatus === 'copied' ? 'Ссылка скопирована' : 'Поделиться'}
                  aria-label="Поделиться"
                >
                  <Icon name={shareStatus === 'copied' ? 'check' : 'share'} size={18} />
                </button>
                <Link href="/" className="button button--secondary">К ленте</Link>
                <a
                  className="button button--primary"
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => analytics.articleClick(article.id)}
                >
                  Читать далее
                </a>
              </div>
            </div>
          </div>
        </article>

        {clusterSources.length > 0 && (
          <section className="news-detail__cluster">
            <h2 className="news-detail__section-title">Сравнить источники</h2>
            <div className="news-detail__cluster-list">
              {clusterSources.map((a) => (
                <div key={a.id} className="news-detail__cluster-item">
                  <span className="news-card__source">{a.sourceName}</span>
                  <Link href={newsPath(a.id, a.title)} className="news-detail__cluster-link">
                    {a.title}
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {similarArticles.length > 0 && (
          <section className="news-detail__related">
            <h2 className="news-detail__section-title">Похожие новости</h2>
            <div className="news-detail__related-list">
              {similarArticles.map((a) => (
                <div key={a.id} className="news-detail__related-item">
                  <NewsCard article={asCardArticle(a)} />
                </div>
              ))}
            </div>
          </section>
        )}

        {otherArticles.length > 0 && (
          <section className="news-detail__related news-detail__related--other">
            <h2 className="news-detail__section-title">Другие новости</h2>
            <div className="news-detail__related-list">
              {otherArticles.map((a) => (
                <div key={a.id} className="news-detail__related-item">
                  <NewsCard article={asCardArticle(a)} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default NewsDetailPage;

