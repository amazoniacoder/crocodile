import React, { useEffect, useState, useCallback } from 'react';
import { Icon } from '@/ui-system/icons/components';

interface WeatherLocation {
  id: number;
  name: string;
  nameEn: string;
  country: string;
  latitude: string;
  longitude: string;
  timezone: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

interface Props {
  token: string;
}

const EMPTY_FORM = { name: '', nameEn: '', latitude: '', longitude: '', timezone: 'Europe/Moscow', sortOrder: 0 };

const ZoneK: React.FC<Props> = ({ token }) => {
  const [locations, setLocations] = useState<WeatherLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [collectResult, setCollectResult] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/weather/locations', { headers })
      .then(r => r.json())
      .then(d => { setLocations(d.locations ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (loc: WeatherLocation) => {
    await fetch(`/api/admin/weather/locations/${loc.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ isActive: !loc.isActive }),
    });
    load();
  };

  const deleteLocation = async (id: number) => {
    if (!confirm('Удалить город?')) return;
    await fetch(`/api/admin/weather/locations/${id}`, { method: 'DELETE', headers });
    load();
  };

  const addLocation = async () => {
    if (!form.name || !form.nameEn || !form.latitude || !form.longitude) {
      setError('Заполните все обязательные поля');
      return;
    }
    setError(null);
    const res = await fetch('/api/admin/weather/locations', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: form.name,
        nameEn: form.nameEn,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        timezone: form.timezone,
        sortOrder: form.sortOrder,
      }),
    });
    if (res.ok) {
      setForm(EMPTY_FORM);
      setFormOpen(false);
      load();
    } else {
      const d = await res.json();
      setError(d.error ?? 'Ошибка');
    }
  };

  const collect = async () => {
    setCollecting(true);
    setCollectResult(null);
    const res = await fetch('/api/admin/weather/collect', { method: 'POST', headers });
    const d = await res.json();
    setCollectResult(`Собрано: ${d.collected} городов, ошибок: ${d.errors}`);
    setCollecting(false);
  };

  const active = locations.filter(l => l.isActive).length;

  return (
    <div className="monitor-section">

      {/* Статистика + ручной сбор */}
      <div className="monitor-card">
        <div className="monitor-grid">
          <div className="monitor-stat">
            <div className="monitor-stat__label">Всего городов</div>
            <div className="monitor-stat__value">{locations.length}</div>
          </div>
          <div className="monitor-stat">
            <div className="monitor-stat__label">Активных</div>
            <div className="monitor-stat__value">{active}</div>
          </div>
          <div className="monitor-stat">
            <div className="monitor-stat__label">Сбор погоды</div>
            <div className="monitor-stat__value">
              <button
                className="monitor-btn monitor-btn--primary"
                onClick={collect}
                disabled={collecting}
              >
                {collecting ? <Icon name="loader" size={14} /> : <Icon name="refresh" size={14} />}
                {collecting ? ' Сбор...' : ' Запустить'}
              </button>
            </div>
            {collectResult && <div className="monitor-stat__sub">{collectResult}</div>}
          </div>
        </div>
      </div>

      {/* Кнопка добавления */}
      <div className="monitor-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: formOpen ? 16 : 0 }}>
          <h3 className="monitor-card__title" style={{ margin: 0 }}>Управление городами</h3>
          <button
            className="monitor-btn monitor-btn--primary"
            onClick={() => setFormOpen(v => !v)}
          >
            <Icon name={formOpen ? 'x' : 'add'} size={14} />
            {formOpen ? ' Отмена' : ' Добавить город'}
          </button>
        </div>

        {formOpen && (
          <div className="monitor-form" style={{ marginTop: 16 }}>
            {error && <p style={{ color: 'var(--color-error)', marginBottom: 8 }}>{error}</p>}
            <div className="monitor-form__row">
              <input className="monitor-input" placeholder="Название (рус) *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <input className="monitor-input" placeholder="Name EN *" value={form.nameEn} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} />
            </div>
            <div className="monitor-form__row">
              <input className="monitor-input" placeholder="Широта * (напр. 55.75)" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} />
              <input className="monitor-input" placeholder="Долгота * (напр. 37.61)" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} />
            </div>
            <div className="monitor-form__row">
              <input className="monitor-input" placeholder="Timezone (напр. Europe/Moscow)" value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} />
              <input className="monitor-input" type="number" placeholder="Порядок сортировки" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
            </div>
            <button className="monitor-btn monitor-btn--primary" onClick={addLocation}>
              <Icon name="check" size={14} /> Добавить
            </button>
          </div>
        )}
      </div>

      {/* Таблица городов */}
      <div className="monitor-card">
        {loading ? (
          <p className="monitor-chart__empty">Загрузка...</p>
        ) : (
          <table className="monitor-table">
            <thead>
              <tr>
                <th>Город</th>
                <th>EN</th>
                <th>Координаты</th>
                <th>Timezone</th>
                <th>Порядок</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {locations.map(loc => (
                <tr key={loc.id}>
                  <td>{loc.name}</td>
                  <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{loc.nameEn}</td>
                  <td style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
                    {Number(loc.latitude).toFixed(3)}, {Number(loc.longitude).toFixed(3)}
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{loc.timezone}</td>
                  <td>{loc.sortOrder}</td>
                  <td>
                    <span className={`monitor-badge ${loc.isActive ? 'monitor-badge--green' : 'monitor-badge--red'}`}>
                      {loc.isActive ? 'Активен' : 'Отключён'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="monitor-btn monitor-btn--sm"
                        onClick={() => toggleActive(loc)}
                        title={loc.isActive ? 'Отключить' : 'Включить'}
                      >
                        <Icon name={loc.isActive ? 'eye-off' : 'eye'} size={13} />
                      </button>
                      <button
                        className="monitor-btn monitor-btn--sm monitor-btn--danger"
                        onClick={() => deleteLocation(loc.id)}
                        title="Удалить"
                      >
                        <Icon name="delete" size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ZoneK;
