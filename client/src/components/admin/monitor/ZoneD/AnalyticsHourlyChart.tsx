import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { HourlyPoint } from '@/services/adminApi';

interface Props { data: HourlyPoint[]; }

export const AnalyticsHourlyChart: React.FC<Props> = ({ data }) => {
  const chartData = data.map(p => ({
    hour: p.hour.slice(11, 16),
    pageviews: p.pageviews,
    clicks: p.clicks,
  }));

  return (
    <div className="monitor-card">
      <h3 className="monitor-card__title">Активность по часам (24ч)</h3>
      {chartData.length === 0 ? (
        <p className="monitor-chart__empty">Нет данных</p>
      ) : (
        <div className="monitor-chart" style={{ overflowX: 'auto' }}>
          <LineChart width={520} height={180} data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="pageviews" name="Просмотры" stroke="#3b82f6" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="clicks" name="Клики" stroke="#10b981" dot={false} strokeWidth={2} />
          </LineChart>
        </div>
      )}
    </div>
  );
};
