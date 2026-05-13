import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { DailyPoint } from '@/services/adminApi';

interface Props { data: DailyPoint[]; }

export const AnalyticsDailyChart: React.FC<Props> = ({ data }) => {
  const chartData = data.map(p => ({
    date: p.date.slice(5), // MM-DD
    uniques: p.uniques,
  }));

  return (
    <div className="monitor-card">
      <h3 className="monitor-card__title">Уникальные визиты по дням (30 дней)</h3>
      {chartData.length === 0 ? (
        <p className="monitor-chart__empty">Нет данных</p>
      ) : (
        <div className="monitor-chart" style={{ overflowX: 'auto' }}>
          <BarChart width={520} height={180} data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip formatter={(v) => [v, 'Уникальных']} />
            <Bar dataKey="uniques" fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={20} />
          </BarChart>
        </div>
      )}
    </div>
  );
};
