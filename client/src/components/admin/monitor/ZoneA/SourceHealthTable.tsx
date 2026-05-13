import React, { useState } from 'react';
import { adminApi, SourceStat } from '@/services/adminApi';
import { ToggleSwitch } from '../ToggleSwitch';

interface Props {
  stats: SourceStat[];
  token: string;
  onRefresh: () => void;
  title?: string;
}

function fmtLatency(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} мс`;
  return `${(ms / 1000).toFixed(1)} с`;
}

function statusBadge(stat: SourceStat, isActive: boolean) {
  if (!isActive) return <span className="monitor-badge monitor-badge--off">OFF</span>;
  if (stat.lastError) return <span className="monitor-badge monitor-badge--error" title={stat.lastError}>{stat.lastError}</span>;
  if (stat.errorCount > 0) return <span className="monitor-badge monitor-badge--error">{stat.errorCount} ошиб.</span>;
  if (stat.totalInserted === 0) return <span className="monitor-badge monitor-badge--warn">0 статей</span>;
  return <span className="monitor-badge monitor-badge--ok">OK</span>;
}

export const SourceHealthTable: React.FC<Props> = ({ stats, token, onRefresh, title = 'Здоровье источников (24ч)' }) => {
  const [busy, setBusy]         = useState<number | null>(null);
  const [err, setErr]           = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});

  const toggleActive = async (s: SourceStat) => {
    if (!s.sourceId) return;
    const id = s.sourceId;
    const current = id in overrides ? overrides[id] : !!s.isActive;
    const next = !current;
    setOverrides(o => ({ ...o, [id]: next }));
    setBusy(id);
    setErr(null);
    try {
      await adminApi.updateSource(token, id, { isActive: next });
      onRefresh();
    } catch (e) {
      setOverrides(o => ({ ...o, [id]: current }));
      setErr(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="monitor-card">
      <h3 className="monitor-card__title">{title}</h3>
      {err && <p className="monitor-modal__error">{err}</p>}
      {stats.length === 0 ? (
        <p className="monitor-chart__empty">Нет данных</p>
      ) : (
        <div className="monitor-table-wrap">
          <table className="monitor-table">
            <thead>
              <tr>
                <th>Источник</th>
                <th>Регион</th>
                <th>Статьи</th>
                <th>Latency</th>
                <th>Статус</th>
                <th>Последний сбор</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => {
                const isActive = s.sourceId != null && s.sourceId in overrides
                  ? overrides[s.sourceId]
                  : !!s.isActive;
                return (
                  <tr key={s.sourceId ?? i}>
                    <td><span className="monitor-table__name">{s.sourceName}</span></td>
                    <td className="monitor-table__muted">{s.region ?? '—'}</td>
                    <td><strong>{s.totalInserted}</strong></td>
                    <td className="monitor-table__muted">{fmtLatency(s.avgLatencyMs)}</td>
                    <td>{statusBadge(s, isActive)}</td>
                    <td className="monitor-table__muted">
                      {s.lastCollectedAt
                        ? new Date(s.lastCollectedAt).toLocaleString('ru', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td>
                      {s.sourceId && (
                        <ToggleSwitch
                          checked={isActive}
                          onChange={() => toggleActive(s)}
                          disabled={busy === s.sourceId}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
