import { useEffect, useState } from 'react';

interface PageData {
  path: string;
  views: number;
  uniques: number;
}

interface Props {
  token: string;
}

export function TopPagesTable({ token }: Props) {
  const [data, setData] = useState<PageData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    fetch('/api/admin/analytics/pages?hours=24', {
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
    return <div className="top-pages top-pages--loading">Загрузка...</div>;
  }

  if (data.length === 0) {
    return <div className="top-pages top-pages--empty">Нет данных</div>;
  }

  return (
    <div className="top-pages">
      <table className="top-pages__table">
        <thead>
          <tr>
            <th>#</th>
            <th>Страница</th>
            <th>Просмотры</th>
            <th>Уникальные</th>
          </tr>
        </thead>
        <tbody>
          {data.map((page, index) => (
            <tr key={page.path}>
              <td>{index + 1}</td>
              <td className="top-pages__path">{page.path || '/'}</td>
              <td>{page.views}</td>
              <td>{page.uniques}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
