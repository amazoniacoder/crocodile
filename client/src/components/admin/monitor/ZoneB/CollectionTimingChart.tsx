import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { TimingPoint } from '@/services/adminApi';

interface Props {
  data: TimingPoint[];
  width?: number;
}

export const CollectionTimingChart: React.FC<Props> = ({ data, width = 800 }) => {
  const byMinute = new Map<string, number>();
  [...data].reverse().forEach(p => {
    if (p.fetchDurationMs == null) return;
    const d = new Date(p.collectedAt);
    const key = d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    byMinute.set(key, (byMinute.get(key) ?? 0) + p.fetchDurationMs);
  });

  const chartData = Array.from(byMinute.entries()).map(([label, ms]) => ({
    label,
    sec: Math.round(ms / 100) / 10,
  }));

  return (
    <div className="monitor-card">
      <h3 className="monitor-card__title">Время цикла сбора (сек)</h3>
      {chartData.length === 0 ? (
        <p className="monitor-chart__empty">Нет данных</p>
      ) : (
        <div className="monitor-chart" style={{ overflowX: 'auto' }}>
          <LineChart width={width} height={220} data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [`${v} с`, 'Длительность']} />
            <Line type="monotone" dataKey="sec" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </div>
      )}
    </div>
  );
};
