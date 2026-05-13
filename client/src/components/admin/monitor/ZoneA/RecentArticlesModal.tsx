import React, { useEffect, useState } from 'react';
import { adminApi, RecentArticle } from '@/services/adminApi';

interface Props {
  token: string;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  economy: 'Экономика', tech: 'Технологии', politics: 'Политика',
  society: 'Общество', other: 'Другое',
};

export const RecentArticlesModal: React.FC<Props> = ({ token, onClose }) => {
  const [articles, setArticles] = useState<RecentArticle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    adminApi.getRecentArticles(token, 1)
      .then(res => { setArticles(res.articles); setLoading(false); })
      .catch(err => { setError(err instanceof Error ? err.message : 'Ошибка'); setLoading(false); });
  }, [token]);

  return (
    <div className="monitor-modal-overlay" onClick={onClose}>
      <div className="monitor-modal monitor-modal--wide" onClick={e => e.stopPropagation()}>
        <div className="monitor-modal__header">
          <h2 className="monitor-modal__title">Новые статьи за последний час</h2>
          <button className="monitor-modal__close" onClick={onClose}>✕</button>
        </div>

        {loading && <p className="monitor-chart__empty">Загрузка...</p>}
        {error   && <p className="monitor-modal__error">{error}</p>}

        {!loading && !error && (
          articles.length === 0
            ? <p className="monitor-chart__empty">Новых статей за последний час нет</p>
            : (
              <div className="monitor-modal__count">{articles.length} статей</div>
            )
        )}

        {!loading && articles.length > 0 && (
          <div className="monitor-table-wrap">
            <table className="monitor-table">
              <thead>
                <tr>
                  <th>Заголовок</th>
                  <th>Источник</th>
                  <th>Регион</th>
                  <th>Категория</th>
                  <th>Собрано</th>
                </tr>
              </thead>
              <tbody>
                {articles.map(a => (
                  <tr key={a.id}>
                    <td>
                      <a className="monitor-link" href={a.url} target="_blank" rel="noreferrer">
                        {a.title}
                      </a>
                    </td>
                    <td className="monitor-table__muted">{a.sourceName}</td>
                    <td className="monitor-table__muted">{a.region}</td>
                    <td className="monitor-table__muted">{CATEGORY_LABELS[a.category] ?? a.category}</td>
                    <td className="monitor-table__muted">
                      {new Date(a.fetchedAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
