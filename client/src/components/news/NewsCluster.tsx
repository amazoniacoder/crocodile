import React, { useState } from 'react';
import type { NewsArticle } from '../../../../shared/types/news';

interface NewsClusterProps {
  articles: NewsArticle[];
}

export const NewsCluster: React.FC<NewsClusterProps> = ({ articles }) => {
  const [open, setOpen] = useState(false);

  if (!articles.length) return null;

  return (
    <div className="news-cluster">
      <button
        className="news-card__cluster-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="news-card__cluster-count">{articles.length}</span>
        {open ? '▲ Скрыть источники' : '▼ Сравнить источники'}
      </button>

      {open && (
        <div className="news-cluster__list">
          {articles.map((a) => (
            <div key={a.id} className="news-cluster__item">
              <span className="news-card__source">{a.sourceName}</span>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="news-cluster__title"
              >
                {a.title}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
