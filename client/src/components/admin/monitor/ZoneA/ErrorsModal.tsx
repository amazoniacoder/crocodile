import React from 'react';
import { SourceStat } from '@/services/adminApi';

interface Props {
  stats: SourceStat[];
  onClose: () => void;
}

export const ErrorsModal: React.FC<Props> = ({ stats, onClose }) => {
  const errorSources = stats.filter(s => s.errorCount > 0);

  return (
    <div className="monitor-modal-overlay" onClick={onClose}>
      <div className="monitor-modal monitor-modal--wide" onClick={e => e.stopPropagation()}>
        <div className="monitor-modal__header">
          <h2 className="monitor-modal__title">Ошибки за последний час</h2>
          <button className="monitor-modal__close" onClick={onClose}>✕</button>
        </div>

        {errorSources.length === 0 ? (
          <p className="monitor-chart__empty">Ошибок нет</p>
        ) : (
          <>
            <div className="monitor-modal__count">{errorSources.length} источников с ошибками</div>
            <div className="monitor-table-wrap">
              <table className="monitor-table">
                <thead>
                  <tr>
                    <th>Источник</th>
                    <th>Регион</th>
                    <th>Ошибок</th>
                    <th>Последняя ошибка</th>
                    <th>Последний сбор</th>
                  </tr>
                </thead>
                <tbody>
                  {errorSources.map((s, i) => (
                    <tr key={s.sourceId ?? i}>
                      <td><span className="monitor-table__name">{s.sourceName}</span></td>
                      <td className="monitor-table__muted">{s.region ?? '—'}</td>
                      <td>
                        <span className="monitor-badge monitor-badge--error">{s.errorCount}</span>
                      </td>
                      <td className="monitor-table__muted monitor-table__error-text">
                        {s.lastError ?? '—'}
                      </td>
                      <td className="monitor-table__muted">
                        {s.lastCollectedAt
                          ? new Date(s.lastCollectedAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
