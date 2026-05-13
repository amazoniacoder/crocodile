import { useEffect, useState } from 'react';

interface CityData {
  city: string;
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

export function TopCitiesTable({ token }: Props) {
  const [data, setData] = useState<CityData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    fetch('/api/admin/analytics/cities?hours=168&limit=20', {
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
    return <div className="top-cities top-cities--loading">Загрузка...</div>;
  }

  if (data.length === 0) {
    return <div className="top-cities top-cities--empty">Нет данных о городах</div>;
  }

  const totalVisits = data.reduce((sum, d) => sum + d.visits, 0);
  const maxVisits = Math.max(...data.map(d => d.visits), 1);

  return (
    <div className="top-cities">
      <div className="top-cities__summary">
        <span className="top-cities__stat-label">Всего визитов</span>
        <span className="top-cities__stat-value">{totalVisits}</span>
      </div>

      <div className="top-cities__grid">
        {data.map(({ city, country, visits }, index) => {
          const percent = (visits / totalVisits) * 100;
          const barWidth = (visits / maxVisits) * 100;
          
          return (
            <div key={`${country}-${city}`} className="top-cities__row">
              <div className="top-cities__rank">{index + 1}</div>
              
              <div className="top-cities__location">
                <span 
                  className="top-cities__flag"
                  role="img"
                  aria-label={COUNTRY_NAMES[country] || country}
                >
                  {String.fromCodePoint(...country.split('').map(c => 127397 + c.charCodeAt(0)))}
                </span>
                <div className="top-cities__info">
                  <span className="top-cities__city">{city}</span>
                  <span className="top-cities__country">{COUNTRY_NAMES[country] || country}</span>
                </div>
              </div>
              
              <div className="top-cities__metrics">
                <div className="top-cities__bar-container">
                  <div 
                    className="top-cities__bar"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="top-cities__numbers">
                  <span className="top-cities__visits">{visits}</span>
                  <span className="top-cities__percent">{percent.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
