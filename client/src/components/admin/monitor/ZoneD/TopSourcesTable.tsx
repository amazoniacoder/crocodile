import React, { useState } from 'react';
import { TopSource, adminApi } from '@/services/adminApi';
import { Icon } from '@/ui-system/icons/components';

interface Props {
  data: TopSource[];
  token: string;
  onReload: () => void;
}

const REGION_LABELS: Record<string, string> = { russia: 'Россия', world: 'Мир' };

export const TopSourcesTable: React.FC<Props> = ({ data, token, onReload }) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Удалить все клики по статьям? Это сбросит топ источников.')) return;
    setDeleting(true);
    try {
      await adminApi.deleteAllClicks(token);
      onReload();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="monitor-card">
      <div className="monitor-card__header">
        <h3 className="monitor-card__title">Топ источников по кликам (24ч)</h3>
        <button
          className="monitor-btn monitor-btn--icon monitor-btn--danger"
          onClick={handleDelete}
          disabled={deleting || data.length === 0}
          title="Удалить все клики"
        >
          <Icon name="delete" size={16} />
        </button>
      </div>
      {data.length === 0 ? (
        <p className="monitor-chart__empty">Нет данных</p>
      ) : (
        <div className="monitor-table-wrap">
          <table className="monitor-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Источник</th>
                <th>Регион</th>
                <th>Клики</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s, i) => (
                <tr key={s.sourceName}>
                  <td className="monitor-table__muted">{i + 1}</td>
                  <td>{s.sourceName}</td>
                  <td className="monitor-table__muted">{REGION_LABELS[s.region] ?? s.region}</td>
                  <td><strong>{s.clicks}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
