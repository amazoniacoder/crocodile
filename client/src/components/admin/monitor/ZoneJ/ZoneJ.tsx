import React, { useEffect, useState, useCallback } from 'react';
import { adminApi, ApiKey } from '@/services/adminApi';
import { Icon } from '@/ui-system/icons/components';
import './ZoneJ.css';

interface Props { token: string; }

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const ZoneJ: React.FC<Props> = ({ token }) => {
  const [keys, setKeys]         = useState<ApiKey[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [newKey, setNewKey]     = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', rpm: 60, rpd: 10000, submitting: false, err: '' });

  const load = useCallback(() => {
    setLoading(true);
    adminApi.getApiKeys(token)
      .then(r => { setKeys(r.keys); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setForm(f => ({ ...f, err: 'Введите название' })); return; }
    setForm(f => ({ ...f, submitting: true, err: '' }));
    try {
      const res = await adminApi.createApiKey(token, form.name.trim(), form.rpm, form.rpd);
      setNewKey(res.key);
      setForm({ name: '', rpm: 60, rpd: 10000, submitting: false, err: '' });
      load();
    } catch (e: any) {
      setForm(f => ({ ...f, submitting: false, err: e.message }));
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Отозвать ключ «${name}»?`)) return;
    setRevoking(id);
    try {
      await adminApi.revokeApiKey(token, id);
      load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRevoking(null);
    }
  };

  const handleCopy = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="monitor-section zone-j">

      {newKey && (
        <div className="monitor-card zone-j__new-key">
          <p className="zone-j__new-key-title">
            <Icon name="check" size={16} />
            Ключ создан — сохраните его сейчас, повторно он не отображается
          </p>
          <div className="zone-j__new-key-row">
            <code className="zone-j__key-code">{newKey}</code>
            <button className="monitor-btn monitor-btn--primary" onClick={handleCopy}>
              {copied
                ? <><Icon name="check" size={14} /> Скопировано</>
                : 'Копировать'
              }
            </button>
            <button className="monitor-btn" onClick={() => setNewKey(null)}>Закрыть</button>
          </div>
        </div>
      )}

      <div className="monitor-card zone-j__form-card">
        <h3 className="zone-j__form-title">Создать новый ключ</h3>
        <form onSubmit={handleCreate} className="zone-j__form">
          <div className="zone-j__field zone-j__field--name">
            <label className="zone-j__label">Название</label>
            <input
              className="monitor-input"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Telegram-бот, RSS-ридер..."
              maxLength={100}
            />
          </div>
          <div className="zone-j__field zone-j__field--number">
            <label className="zone-j__label">Req/мин</label>
            <input
              className="monitor-input"
              type="number" min={1} max={600}
              value={form.rpm}
              onChange={e => setForm(f => ({ ...f, rpm: Number(e.target.value) }))}
            />
          </div>
          <div className="zone-j__field zone-j__field--number">
            <label className="zone-j__label">Req/день</label>
            <input
              className="monitor-input"
              type="number" min={1} max={1000000}
              value={form.rpd}
              onChange={e => setForm(f => ({ ...f, rpd: Number(e.target.value) }))}
            />
          </div>
          <button
            className="monitor-btn monitor-btn--primary"
            type="submit"
            disabled={form.submitting}
          >
            {form.submitting
              ? <><Icon name="loader" size={14} /> Создание...</>
              : <><Icon name="add" size={14} /> Создать</>
            }
          </button>
        </form>
        {form.err && <p className="monitor-modal__error">{form.err}</p>}
        <p className="zone-j__hint">
          Без ключа: 30 req/мин. Ключ передаётся через заголовок <code>X-Api-Key</code> или параметр <code>?api_key=</code>
        </p>
      </div>

      <div className="monitor-card">
        <div className="zone-j__table-header">
          <h3 className="zone-j__table-title">Активные ключи ({keys.filter(k => k.isActive).length})</h3>
          <button className="monitor-btn" onClick={load}>Обновить</button>
        </div>

        {error && <p className="monitor-modal__error">{error}</p>}

        {loading ? (
          <p className="monitor-chart__empty">Загрузка...</p>
        ) : keys.length === 0 ? (
          <p className="monitor-chart__empty">Ключей пока нет</p>
        ) : (
          <table className="monitor-table">
            <thead>
              <tr>
                <th className="monitor-table__th">Название</th>
                <th className="monitor-table__th">Req/мин</th>
                <th className="monitor-table__th">Req/день</th>
                <th className="monitor-table__th">Создан</th>
                <th className="monitor-table__th">Последнее использование</th>
                <th className="monitor-table__th">Статус</th>
                <th className="monitor-table__th"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id} className="monitor-table__row">
                  <td className="monitor-table__td monitor-table__td--bold">{k.name}</td>
                  <td className="monitor-table__td monitor-table__td--num">{k.requestsPerMinute}</td>
                  <td className="monitor-table__td monitor-table__td--num">{k.requestsPerDay.toLocaleString()}</td>
                  <td className="monitor-table__td">{fmt(k.createdAt)}</td>
                  <td className="monitor-table__td">{fmt(k.lastUsedAt)}</td>
                  <td className="monitor-table__td">
                    <span className={`monitor-badge ${k.isActive ? 'monitor-badge--green' : 'monitor-badge--red'}`}>
                      {k.isActive ? 'Активен' : 'Отозван'}
                    </span>
                  </td>
                  <td className="monitor-table__td">
                    {k.isActive && (
                      <button
                        className="monitor-btn monitor-btn--danger"
                        onClick={() => handleRevoke(k.id, k.name)}
                        disabled={revoking === k.id}
                      >
                        {revoking === k.id
                          ? <Icon name="loader" size={14} />
                          : 'Отозвать'
                        }
                      </button>
                    )}
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

export default ZoneJ;
