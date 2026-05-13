import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'wouter';
import { Icon } from '@/ui-system/icons/components';

interface HotEntity {
  id: number;
  entityText: string;
  entityType: 'PER' | 'ORG' | 'LOC';
  mentionCount: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const TABS = [
  { type: 'PER', label: <><Icon name="person"   size={14} /> Персоны</> },
  { type: 'LOC', label: <><Icon name="location" size={14} /> Места</> },
] as const;

const TrendingSidebar: React.FC<Props> = ({ open, onClose }) => {
  const [tab, setTab] = useState<'PER' | 'LOC'>('PER');
  const [data, setData]       = useState<HotEntity[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback((type: 'PER' | 'ORG' | 'LOC') => {
    setLoading(true);
    fetch(`/api/news/hot-entities?type=${type}&limit=10&hours=48`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setData(d.data ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) load(tab);
  }, [open, tab, load]);

  const maxCount = data[0]?.mentionCount ?? 1;

  return (
    <aside
      className={`news-aggregator__trending${open ? ' news-aggregator__trending--open' : ''}`}
      onClick={e => e.stopPropagation()}
    >
      <div className="news-aggregator__sidebar-header">
        <h3 className="news-aggregator__sidebar-title">В тренде</h3>
      </div>

      <div className="trending__tabs">
        {TABS.map(t => (
          <button
            key={t.type}
            className={`trending__tab${tab === t.type ? ' trending__tab--active' : ''}`}
            onClick={() => setTab(t.type)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="trending__body">
        {loading ? (
          <div className="trending__skeleton">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="trending__skeleton-row" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <p className="trending__empty">
            Данные появятся после первого цикла обновления (раз в час).
          </p>
        ) : (
          <table className="trending__table">
            <tbody>
              {data.map((row, i) => (
                <tr key={row.id} className="trending__row">
                  <td className="trending__num">{i + 1}</td>
                  <td className="trending__name">
                    <Link
                      href={`/entity/${encodeURIComponent(row.entityText)}`}
                      className="trending__link"
                      onClick={onClose}
                    >
                      {row.entityText}
                    </Link>
                  </td>
                  <td className="trending__count">{row.mentionCount}</td>
                  <td className="trending__bar-cell">
                    <div className="trending__bar-wrap">
                      <div
                        className="trending__bar"
                        style={{ width: `${Math.round((row.mentionCount / maxCount) * 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="trending__footer">
        Данные из новостей за последние 48 часов
      </p>
    </aside>
  );
};

export default TrendingSidebar;
