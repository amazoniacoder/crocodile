import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface DeviceData {
  deviceType: string;
  count: number;
}

const COLORS: Record<string, string> = {
  mobile: '#3b82f6',
  desktop: '#10b981',
  tablet: '#f59e0b',
};

const LABELS: Record<string, string> = {
  mobile: 'Мобильные',
  desktop: 'Десктоп',
  tablet: 'Планшеты',
};

interface Props {
  token: string;
}

export function DevicesChart({ token }: Props) {
  const [data, setData] = useState<DeviceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    fetch('/api/admin/analytics/devices?hours=24', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        setData(d.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <div className="devices-chart devices-chart--loading">Загрузка...</div>;
  }

  if (data.length === 0) {
    return <div className="devices-chart devices-chart--empty">Нет данных</div>;
  }

  const chartData = data.map(d => ({
    name: LABELS[d.deviceType] || d.deviceType,
    value: d.count,
    color: COLORS[d.deviceType] || '#6b7280',
  }));

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="devices-chart">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      <div className="devices-chart__stats">
        {data.map(({ deviceType, count }) => (
          <div key={deviceType} className="devices-chart__stat">
            <div 
              className="devices-chart__indicator" 
              style={{ backgroundColor: COLORS[deviceType] || '#6b7280' }}
            />
            <span className="devices-chart__label">{LABELS[deviceType] || deviceType}</span>
            <span className="devices-chart__value">{count}</span>
            <span className="devices-chart__percent">
              ({((count / total) * 100).toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
