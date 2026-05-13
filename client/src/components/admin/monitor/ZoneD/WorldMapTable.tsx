import { useEffect, useState } from 'react';

interface CountryData {
  country: string;
  visits: number;
}

interface Props {
  token: string;
}

const COUNTRY_NAMES: Record<string, string> = {
  RU: 'Россия', US: 'США', CN: 'Китай', JP: 'Япония', DE: 'Германия',
  GB: 'Великобритания', FR: 'Франция', IN: 'Индия', IT: 'Италия', BR: 'Бразилия',
  CA: 'Канада', KR: 'Южная Корея', ES: 'Испания', MX: 'Мексика', ID: 'Индонезия',
  TR: 'Турция', SA: 'Саудовская Аравия', PL: 'Польша', NL: 'Нидерланды', AR: 'Аргентина',
  SE: 'Швеция', BE: 'Бельгия', TH: 'Таиланд', AT: 'Австрия', NO: 'Норвегия',
  UA: 'Украина', AE: 'ОАЭ', MY: 'Малайзия', SG: 'Сингапур', IL: 'Израиль',
  PH: 'Филиппины', VN: 'Вьетнам', BD: 'Бангладеш', PK: 'Пакистан', EG: 'Египет',
};

export function WorldMapTable({ token }: Props) {
  const [data, setData] = useState<CountryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    fetch('/api/admin/analytics/geography?hours=168', {
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
    return <div className="geography-table geography-table--loading">Загрузка...</div>;
  }

  if (data.length === 0) {
    return <div className="geography-table geography-table--empty">Нет данных</div>;
  }

  const totalVisits = data.reduce((sum, d) => sum + d.visits, 0);
  const maxVisits = Math.max(...data.map(d => d.visits), 1);

  return (
    <div className="geography-table">
      <div className="geography-table__summary">
        <div className="geography-table__stat">
          <span className="geography-table__stat-label">Всего визитов</span>
          <span className="geography-table__stat-value">{totalVisits}</span>
        </div>
        <div className="geography-table__stat">
          <span className="geography-table__stat-label">Стран</span>
          <span className="geography-table__stat-value">{data.length}</span>
        </div>
      </div>

      <div className="geography-table__grid">
        {data.map(({ country, visits }) => {
          const percent = (visits / totalVisits) * 100;
          const barWidth = (visits / maxVisits) * 100;
          
          return (
            <div key={country} className="geography-table__row">
              <div className="geography-table__country">
                <span 
                  className="geography-table__flag"
                  role="img"
                  aria-label={COUNTRY_NAMES[country] || country}
                >
                  {String.fromCodePoint(...country.split('').map(c => 127397 + c.charCodeAt(0)))}
                </span>
                <div className="geography-table__info">
                  <span className="geography-table__name">
                    {COUNTRY_NAMES[country] || country}
                  </span>
                  <span className="geography-table__code">{country}</span>
                </div>
              </div>
              
              <div className="geography-table__metrics">
                <div className="geography-table__bar-container">
                  <div 
                    className="geography-table__bar"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="geography-table__numbers">
                  <span className="geography-table__visits">{visits}</span>
                  <span className="geography-table__percent">{percent.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
