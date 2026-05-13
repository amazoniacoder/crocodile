import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ChartPoint } from '@/services/adminApi';

interface Props {
  data: ChartPoint[];
  width?: number;
}

export const ActivityChart: React.FC<Props> = ({ data, width = 900 }) => {
  const chartData = useMemo(() => {
    // Группируем по часу — суммируем все источники
    const byHour = new Map<string, number>();
    data.forEach(p => {
      const hour = new Date(p.hour).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
      byHour.set(hour, (byHour.get(hour) ?? 0) + p.articlesInserted);
    });
    return Array.from(byHour.entries()).map(([hour, count]) => ({ hour, count }));
  }, [data]);

  return (
    <div className="monitor-card">
      <h3 className="monitor-card__title">Активность сбора по часам (24ч)</h3>
      {chartData.length === 0 ? (
        <p className="monitor-chart__empty">Нет данных</p>
      ) : (
        <div className="monitor-chart" style={{ overflowX: 'auto' }}>
          <BarChart width={width} height={180} data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip formatter={(v) => [v, 'Статей']} />
            <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={24} />
          </BarChart>
        </div>
      )}
    </div>
  );
};
