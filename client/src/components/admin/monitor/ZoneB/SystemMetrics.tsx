import React, { useEffect, useState } from 'react';
import { SystemMetrics as TSystemMetrics } from '@/services/adminApi';

interface Props {
  data: TSystemMetrics;
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}д ${h}ч ${m}м`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

function ProgressBar({ pct }: { pct: number }) {
  const cls = pct >= 90 ? 'monitor-progress__bar--error' : pct >= 70 ? 'monitor-progress__bar--warn' : '';
  return (
    <div className="monitor-progress">
      <div className={`monitor-progress__bar ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function RunningTimer({ startedAt }: { startedAt: string | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const base = startedAt ? Date.now() - new Date(startedAt).getTime() : 0;
    setElapsed(Math.floor(base / 1000));
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return <span>{elapsed} с</span>;
}

function fmtClock(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';
}

export const SystemMetrics: React.FC<Props> = ({ data }) => {
  const { heap, cpu, uptime, node, collector } = data;

  return (
    <div className="monitor-card">
      <h3 className="monitor-card__title">Системные метрики</h3>
      <div className="monitor-grid">

        <div className="monitor-stat">
          <div className="monitor-stat__label">RSS</div>
          <div className="monitor-stat__value">{heap.rssMb} <span className="monitor-stat__unit">МБ</span></div>
          <div className="monitor-stat__sub">JS Heap: {heap.usedMb} МБ из {heap.totalMb} МБ ({heap.usedPercent}%)</div>
          <ProgressBar pct={heap.usedPercent} />
        </div>

        <div className="monitor-stat">
          <div className="monitor-stat__label">CPU Load avg</div>
          <div className="monitor-stat__value">{cpu.loadAvg1}</div>
          <div className="monitor-stat__sub">5м: {cpu.loadAvg5} · 15м: {cpu.loadAvg15} · {cpu.cores} ядер</div>
        </div>

        <div className="monitor-stat">
          <div className="monitor-stat__label">Uptime сервера</div>
          <div className="monitor-stat__value">{fmtUptime(uptime.serverSec)}</div>
          <div className="monitor-stat__sub">ОС: {fmtUptime(uptime.osSec)} · {node.version}</div>
        </div>

        <div className={`monitor-stat${collector.isRunning ? ' monitor-stat--active' : ''}`}>
          <div className="monitor-stat__label">Цикл сбора</div>
          <div className="monitor-stat__value">
            {collector.isRunning
              ? <><span className="monitor-badge monitor-badge--warn">▶</span> <RunningTimer startedAt={collector.cycleStartedAt} /></>
              : collector.lastCycleDurationMs != null
                ? `${(collector.lastCycleDurationMs / 1000).toFixed(1)} с`
                : '—'}
          </div>
          <div className="monitor-stat__sub">
            {collector.isRunning
              ? 'выполняется...'
              : collector.lastCycleAt
                ? `завершён: ${fmtClock(collector.lastCycleAt)}`
                : '—'}
          </div>
          <div className="monitor-stat__sub">следующий fast: {fmtClock(collector.nextFastCycleAt)}</div>
          <div className="monitor-stat__sub">следующий slow: {fmtClock(collector.nextSlowCycleAt)}</div>
          {collector.isRunning && collector.totalSourcesInCycle > 0 && (
            <div className="monitor-stat__sub">
              прогресс: {collector.currentSourceIndex ?? 0}/{collector.totalSourcesInCycle}
              {collector.currentSourceName ? ` · ${collector.currentSourceName}` : ''}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
