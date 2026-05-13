import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { SourceStat } from '@/services/adminApi';

interface Props {
  stats: SourceStat[];
  width?: number;
}

const SEGMENTS = [
  { key: 'world',  label: '🌍 Мир',              color: '#3b82f6' },
  { key: 'russia', label: '🇷🇺 Россия',           color: '#10b981' },
  { key: 'cities', label: '🏙️ Города России',    color: '#f59e0b' },
];

export const RegionPieChart: React.FC<Props> = ({ stats, width = 480 }) => {
  const data = useMemo(() => {
    const world  = stats.filter(s => s.region === 'world').reduce((sum, s) => sum + s.totalInserted, 0);
    const russia = stats.filter(s => s.region === 'russia' && !s.city).reduce((sum, s) => sum + s.totalInserted, 0);
    const cities = stats.filter(s => s.region === 'russia' && !!s.city).reduce((sum, s) => sum + s.totalInserted, 0);
    const total  = world + russia + cities;

    if (total === 0) return null;

    return [
      { key: 'world',  label: '🌍 Мир',           value: world,  pct: Math.round(world  / total * 100) },
      { key: 'russia', label: '🇷🇺 Россия',        value: russia, pct: Math.round(russia / total * 100) },
      { key: 'cities', label: '🏙️ Города России', value: cities, pct: Math.round(cities / total * 100) },
    ].filter(d => d.value > 0);
  }, [stats]);

  if (!data) {
    return (
      <div className="monitor-card">
        <h3 className="monitor-card__title">Распределение по регионам</h3>
        <p className="monitor-chart__empty">Нет данных</p>
      </div>
    );
  }

  const colorMap = Object.fromEntries(SEGMENTS.map(s => [s.key, s.color]));
  const labelRenderer = ({ percent }: { percent?: number }) =>
    `${Math.round((percent ?? 0) * 100)}%`;

  return (
    <div className="monitor-card">
      <h3 className="monitor-card__title">Распределение по регионам (24ч)</h3>
      <div className="monitor-chart monitor-chart--pie">
        <PieChart width={width} height={260}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={100}
            innerRadius={55}
            paddingAngle={2}
            label={labelRenderer}
            labelLine={false}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={colorMap[entry.key]} />
            ))}
          </Pie>
          <Tooltip formatter={(value, name) => [`${Number(value ?? 0)} статей`, String(name ?? '')]} />
          <Legend
            formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>}
          />
        </PieChart>
      </div>
      <div className="monitor-pie-legend">
        {data.map(d => (
          <div key={d.key} className="monitor-pie-legend__item">
            <span className="monitor-pie-legend__dot" style={{ background: colorMap[d.key] }} />
            <span className="monitor-pie-legend__label">{d.label}</span>
            <span className="monitor-pie-legend__value">{d.value}</span>
            <span className="monitor-pie-legend__pct">{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
