import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { PeakHour } from '@/services/adminApi';

interface Props { data: PeakHour[]; }

export const AnalyticsPeakChart: React.FC<Props> = ({ data }) => {
  const chartData = data.map(p => ({
    hour: `${String(p.hour).padStart(2, '0')}:00`,
    avg: p.avgEvents,
  }));

  return (
    <div className="monitor-card">
      <h3 className="monitor-card__title">Пиковые часы активности (среднее за 7 дней)</h3>
      {chartData.length === 0 ? (
        <p className="monitor-chart__empty">Нет данных</p>
      ) : (
        <div className="monitor-chart" style={{ overflowX: 'auto' }}>
          <BarChart width={900} height={160} data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip formatter={(v) => [v, 'Событий (среднее)']} />
            <Bar dataKey="avg" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={28} />
          </BarChart>
        </div>
      )}
    </div>
  );
};
