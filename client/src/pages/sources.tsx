import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'wouter';
import { Spinner } from '@/ui-system/components/feedback';
import type { NewsSource } from '../../../shared/types/news';

const REGION_LABELS: Record<string, string> = {
  russia: 'Россия',
  world: 'Мир',
};

const CATEGORY_LABELS: Record<string, string> = {
  economy: 'Экономика',
  tech: 'Технологии',
  politics: 'Политика',
  society: 'Общество',
  other: 'Другое',
};

const REGION_COLORS: Record<string, string> = {
  russia: 'sources__badge--russia',
  world: 'sources__badge--world',
};

const SourcesPage: React.FC = () => {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'russia' | 'world'>('all');

  useEffect(() => {
    fetch('/api/news/sources')
      .then(r => r.json())
      .then(d => setSources(d.sources ?? []))
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? sources : sources.filter(s => s.region === filter);
  const russiaCount = sources.filter(s => s.region === 'russia').length;
  const worldCount = sources.filter(s => s.region === 'world').length;

  return (
    <main className="sources">
      <Helmet>
        <title>Источники | Crocodile</title>
        <meta name="description" content="Белый список проверенных RSS-источников Crocodile. Только надёжные СМИ без скрытого ранжирования." />
      </Helmet>

      <div className="sources__container">
        <header className="sources__header">
          <h1 className="sources__title">Источники</h1>
          <p className="sources__lead">
            Белый список проверенных СМИ. Регион и категория каждой статьи наследуются от источника — без анализа заголовков и скрытого ранжирования.
          </p>
        </header>

        <div className="sources__stats">
          <button
            className={`sources__filter${filter === 'all' ? ' sources__filter--active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Все <span className="sources__filter-count">{sources.length}</span>
          </button>
          <button
            className={`sources__filter${filter === 'russia' ? ' sources__filter--active' : ''}`}
            onClick={() => setFilter('russia')}
          >
            Россия <span className="sources__filter-count">{russiaCount}</span>
          </button>
          <button
            className={`sources__filter${filter === 'world' ? ' sources__filter--active' : ''}`}
            onClick={() => setFilter('world')}
          >
            Мир <span className="sources__filter-count">{worldCount}</span>
          </button>
        </div>

        {loading && (
          <div className="sources__loading">
            <Spinner size="lg" />
          </div>
        )}

        {!loading && (
          <div className="sources__grid">
            {filtered.map(source => (
              <div key={source.id} className="sources__card">
                <div className="sources__card-header">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sources__card-name"
                  >
                    {source.name}
                  </a>
                  <div className="sources__card-badges">
                    <span className={`sources__badge ${REGION_COLORS[source.region] ?? ''}`}>
                      {REGION_LABELS[source.region] ?? source.region}
                    </span>
                    {source.city && (
                      <span className="sources__badge sources__badge--city">{source.city}</span>
                    )}
                  </div>
                </div>
                <div className="sources__card-meta">
                  <span className="sources__card-category">
                    {CATEGORY_LABELS[source.category] ?? source.category}
                  </span>
                  {source.lastFetchedAt && (
                    <time className="sources__card-time" dateTime={source.lastFetchedAt}>
                      Обновлено: {new Date(source.lastFetchedAt).toLocaleString('ru-RU', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </time>
                  )}
                </div>
                <div className="sources__card-actions">
                  <Link
                    href={`/${source.region === 'russia' ? 'russia' : 'world'}?sourceIds=${source.id}`}
                    className="sources__card-link"
                  >
                    Читать новости →
                  </Link>
                  <a
                    href={source.rssUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sources__card-rss"
                    title="RSS-лента"
                  >
                    RSS
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <p className="sources__empty">Источники не найдены.</p>
        )}
      </div>
    </main>
  );
};

export default SourcesPage;
