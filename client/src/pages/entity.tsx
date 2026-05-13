import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'wouter';
import { Helmet } from 'react-helmet-async';
import { Spinner, Alert } from '@/ui-system/components/feedback';
import { NewsCard } from '@/components/news/NewsCard';
import type { NewsArticle, NewsArticleWithCluster } from '../../../shared/types/news';

const asCard = (a: NewsArticle): NewsArticleWithCluster => ({ ...a, cluster: null, clusterArticles: [] });

const EntityPage: React.FC = () => {
  const { term } = useParams<{ term: string }>();
  const decoded = decodeURIComponent(term ?? '');

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!decoded) return;
    setLoading(true);
    setError(null);
    fetch(`/api/news/by-entity?term=${encodeURIComponent(decoded)}&limit=100`)
      .then(r => { if (!r.ok) throw new Error('fetch'); return r.json(); })
      .then(d => { setArticles(d.articles ?? []); })
      .catch(() => setError('Не удалось загрузить новости.'))
      .finally(() => setLoading(false));
  }, [decoded]);

  const title = `В тренде: ${decoded} | NewsAggregator`;

  return (
    <div className="entity-page">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={`Все новости по теме «${decoded}» за последние 48 часов.`} />
      </Helmet>

      <div className="entity-page__wrap">
        <div className="entity-page__header">
          <Link href="/" className="entity-page__back">← К ленте</Link>
          <h1 className="entity-page__title">В тренде: <span>{decoded}</span></h1>
          {!loading && <p className="entity-page__count">{articles.length} новостей за 48 часов</p>}
        </div>

        {loading && <div className="entity-page__center"><Spinner size="lg" /></div>}
        {error   && <Alert variant="error" title="Ошибка" message={error} />}

        {!loading && !error && articles.length === 0 && (
          <p className="entity-page__empty">Новостей по этой теме пока нет.</p>
        )}

        {!loading && !error && articles.length > 0 && (
          <div className="entity-page__feed">
            {articles.map(a => <NewsCard key={a.id} article={asCard(a)} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default EntityPage;
