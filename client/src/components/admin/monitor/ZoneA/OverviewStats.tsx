import React from 'react';
import { SourceStat } from '@/services/adminApi';
import { Zone, ZoneATab } from '@/pages/admin-monitor';

interface Props {
  stats: SourceStat[];
  lastCycleAt: string | null;
  isRunning: boolean;
  lastCycleDurationMs: number | null;
  nextCycleAt: string | null;
  nextFastCycleAt: string | null;
  nextSlowCycleAt: string | null;
  onNavigate: (zone: Zone, tab?: ZoneATab) => void;
  onOpenArticles: () => void;
  onOpenErrors: () => void;
}

export const OverviewStats: React.FC<Props> = ({
  stats, lastCycleAt, isRunning, lastCycleDurationMs, nextCycleAt, nextFastCycleAt, nextSlowCycleAt,
  onNavigate, onOpenArticles, onOpenErrors,
}) => {
  const totalInserted = stats.reduce((s, x) => s + x.totalInserted, 0);
  const totalDuplicate = stats.reduce((s, x) => s + x.totalDuplicate, 0);
  const totalFetched  = totalInserted + totalDuplicate;
  const newPct        = totalFetched > 0 ? Math.round(totalInserted / totalFetched * 100) : 0;
  const totalErrors   = stats.reduce((s, x) => s + x.errorCount, 0);
  const errorSources  = stats.filter(s => s.errorCount > 0).length;

  const fmtTime = (iso: string | null) => iso
    ? new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="monitor-grid monitor-grid--overview">

      <button className="monitor-stat monitor-stat--btn" onClick={onOpenArticles}>
        <div className="monitor-stat__label">Новых статей за 1ч</div>
        <div className="monitor-stat__value">{totalInserted.toLocaleString('ru')}</div>
        <div className="monitor-stat__sub">
          {totalFetched > 0 ? `${newPct}% от ${totalFetched} из RSS` : 'нет данных'}
        </div>
        <div className="monitor-stat__hint">→ открыть список</div>
      </button>

      <button
        className={`monitor-stat monitor-stat--btn${totalErrors > 0 ? ' monitor-stat--warn' : ''}`}
        onClick={onOpenErrors}
      >
        <div className="monitor-stat__label">Ошибки за 1ч</div>
        <div className="monitor-stat__value">{totalErrors}</div>
        <div className="monitor-stat__sub">{errorSources} источников с ошибками</div>
        <div className="monitor-stat__hint">→ открыть список</div>
      </button>

      <button className={`monitor-stat monitor-stat--btn${isRunning ? ' monitor-stat--active' : ''}`} onClick={() => onNavigate('B')}>
        <div className="monitor-stat__label">Коллектор</div>
        <div className="monitor-stat__value" style={{ fontSize: 'var(--font-size-base)' }}>
          {isRunning ? '▶ Работает' : '⏸ Ожидает'}
        </div>
        <div className="monitor-stat__sub">
          {lastCycleAt ? `последний: ${fmtTime(lastCycleAt)}` : '—'}
          {lastCycleDurationMs != null && ` · ${(lastCycleDurationMs / 1000).toFixed(1)}с`}
        </div>
        {nextCycleAt && <div className="monitor-stat__sub">ближайший: {fmtTime(nextCycleAt)}</div>}
        <div className="monitor-stat__sub">следующий fast: {fmtTime(nextFastCycleAt)}</div>
        <div className="monitor-stat__sub">следующий slow: {fmtTime(nextSlowCycleAt)}</div>
        <div className="monitor-stat__hint">→ инфраструктура</div>
      </button>

    </div>
  );
};
