import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { SourceStat } from '@/services/adminApi';

interface Props {
  stats: SourceStat[];
  width?: number;
}

function barColor(inserted: number): string {
  if (inserted === 0) return '#ef4444';
  if (inserted < 5)  return '#f59e0b';
  return '#10b981';
}

export const ArticlesPerSourceChart: React.FC<Props> = ({ stats, width = 800 }) => {
  const data = useMemo(() =>
    [...stats]
      .sort((a, b) => b.totalInserted - a.totalInserted)
      .map(s => ({ name: s.sourceName, value: s.totalInserted })),
    [stats]
  );

  if (data.length === 0) {
    return (
      <div className="monitor-card">
        <h3 className="monitor-card__title">Статьи по источникам за 24ч</h3>
        <p className="monitor-chart__empty">Данных пока нет</p>
      </div>
    );
  }

  const barHeight = 24;
  const height = data.length * barHeight + 60;

  return (
    <div className="monitor-card">
      <h3 className="monitor-card__title">Статьи по источникам за 24ч</h3>
      <div className="monitor-chart" style={{ overflowX: 'auto' }}>
        <BarChart
          width={width}
          height={height}
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => [v, 'Статей']} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((entry, i) => (
              <Cell key={i} fill={barColor(entry.value)} />
            ))}
          </Bar>
        </BarChart>
      </div>
    </div>
  );
};
