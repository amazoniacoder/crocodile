import React, { useState, useEffect } from 'react';
import { adminApi, SourceConfig } from '@/services/adminApi';

interface Props {
  token: string;
}

const KEYS = [
  { key: 'fast_interval_cron', label: 'Быстрый интервал' },
  { key: 'slow_interval_cron', label: 'Медленный интервал' },
] as const;

export const IntervalConfig: React.FC<Props> = ({ token }) => {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [drafts, setDrafts]   = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState<string | null>(null);
  const [saved, setSaved]     = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    adminApi.getConfig(token).then(res => {
      const map: Record<string, string> = {};
      res.configs.forEach((c: SourceConfig) => { map[c.key] = c.value; });
      setConfigs(map);
      setDrafts(map);
    }).catch(() => {});
  }, [token]);

  const handleSave = async (key: string) => {
    setSaving(key);
    setError(null);
    try {
      await adminApi.setConfig(token, key, drafts[key]);
      setConfigs(c => ({ ...c, [key]: drafts[key] }));
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="monitor-card">
      <h3 className="monitor-card__title">Интервалы сбора</h3>
      <div className="monitor-interval-list">
        {KEYS.map(({ key, label }) => (
          <div key={key} className="monitor-interval-row">
            <span className="monitor-interval-row__label">{label}</span>
            <input
              className="monitor-modal__input monitor-interval-row__input"
              value={drafts[key] ?? ''}
              onChange={e => setDrafts(d => ({ ...d, [key]: e.target.value }))}
              placeholder="cron-выражение"
            />
            <button
              className="monitor-btn monitor-btn--primary"
              onClick={() => handleSave(key)}
              disabled={saving === key || drafts[key] === configs[key]}
            >
              {saving === key ? '...' : saved === key ? '✓' : 'Применить'}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="monitor-modal__error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
};
