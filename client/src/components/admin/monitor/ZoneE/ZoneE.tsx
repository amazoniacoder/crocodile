import React, { useEffect, useState, useCallback } from 'react';
import { adminApi, HotEntity } from '@/services/adminApi';
import { Icon } from '@/ui-system/icons/components';

interface Props { token: string; }

const TYPE_LABELS: Record<string, React.ReactNode> = {
  all: 'Все',
  PER: <><Icon name="person" size={14} /> Персоны</>,
  ORG: <><Icon name="building" size={14} /> Организации</>,
  LOC: <><Icon name="location" size={14} /> Локации</>,
};

const TYPE_BADGE: Record<string, string> = {
  PER: 'monitor-badge--blue',
  ORG: 'monitor-badge--green',
  LOC: 'monitor-badge--orange',
};

const ZoneE: React.FC<Props> = ({ token }) => {
  const [data, setData]       = useState<HotEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [hours, setHours]     = useState(24);
  const [type, setType]       = useState('all');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    adminApi.getHotEntities(token, hours, 100, type)
      .then(r => { setData(r.data); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, hours, type]);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 60_000);
    return () => clearInterval(id);
  }, [loadData]);

  const runJob = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await adminApi.runHotEntitiesJob(token);
      setRunResult(`✓ Обработано ${res.data.entitiesProcessed} сущностей за ${res.data.duration}мс`);
      loadData();
    } catch (e: any) {
      setRunResult(`✗ ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const maxCount = data[0]?.mentionCount ?? 1;

  return (
    <div className="monitor-section">

      <div className="monitor-card">
        <div className="zone-e__controls">
          <div className="zone-e__filter-group">
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <button
                key={key}
                className={`monitor__nav-btn${type === key ? ' monitor__nav-btn--active' : ''}`}
                onClick={() => setType(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="zone-e__filter-group">
            {[24, 48].map(h => (
              <button
                key={h}
                className={`monitor__nav-btn${hours === h ? ' monitor__nav-btn--active' : ''}`}
                onClick={() => setHours(h)}
              >
                {h}ч
              </button>
            ))}
          </div>
          <button
            className="monitor-btn monitor-btn--primary"
            onClick={runJob}
            disabled={running}
          >
            {running ? 'Запуск...' : '🔄 Запустить сбор'}
          </button>
        </div>

        {runResult && <p className="monitor-collect__result">{runResult}</p>}

        {error && <p className="monitor-modal__error">{error}</p>}

        {loading ? (
          <p className="monitor-chart__empty">Загрузка...</p>
        ) : data.length === 0 ? (
          <p className="monitor-chart__empty">
            Нет данных. Таблица заполняется раз в час — подождите первого цикла HotEntitiesJob.
          </p>
        ) : (
          <table className="monitor-table">
            <thead>
              <tr>
                <th className="monitor-table__th">#</th>
                <th className="monitor-table__th">Сущность</th>
                <th className="monitor-table__th">Тип</th>
                <th className="monitor-table__th">Упоминаний</th>
                <th className="monitor-table__th">Активность</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={row.id} className="monitor-table__row">
                  <td className="monitor-table__td monitor-table__td--num">{i + 1}</td>
                  <td className="monitor-table__td monitor-table__td--bold">{row.entityText}</td>
                  <td className="monitor-table__td">
                    <span className={`monitor-badge ${TYPE_BADGE[row.entityType] ?? ''}`}>
                      {row.entityType}
                    </span>
                  </td>
                  <td className="monitor-table__td monitor-table__td--num">{row.mentionCount}</td>
                  <td className="monitor-table__td">
                    <div className="zone-e__bar-wrap">
                      <div
                        className="zone-e__bar"
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
    </div>
  );
};

export default ZoneE;
