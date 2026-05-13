import React, { useState } from 'react';
import { adminApi, NewsSource } from '@/services/adminApi';
import { SourceForm } from './SourceForm';
import { ToggleSwitch } from '../ToggleSwitch';

interface Props {
  token: string;
  sources: NewsSource[];
  onRefresh: () => void;
}

export const SourcesTable: React.FC<Props> = ({ token, sources, onRefresh }) => {
  const [editSource, setEditSource] = useState<NewsSource | null>(null);
  const [formOpen, setFormOpen]     = useState(false);
  const [busy, setBusy]             = useState<number | null>(null);
  const [overrides, setOverrides]   = useState<Record<number, boolean>>({});
  const [featuredOverrides, setFeaturedOverrides] = useState<Record<number, boolean>>({});

  const toggleActive = async (source: NewsSource) => {
    const current = source.id in overrides ? overrides[source.id] : source.isActive;
    const next = !current;
    setOverrides(o => ({ ...o, [source.id]: next }));
    setBusy(source.id);
    try {
      await adminApi.updateSource(token, source.id, { isActive: next });
      onRefresh();
    } catch {
      setOverrides(o => ({ ...o, [source.id]: current }));
    } finally {
      setBusy(null);
    }
  };

  const toggleFeatured = async (source: NewsSource) => {
    const current = source.id in featuredOverrides ? featuredOverrides[source.id] : (source.isFeatured ?? false);
    const next = !current;
    setFeaturedOverrides(o => ({ ...o, [source.id]: next }));
    setBusy(source.id);
    try {
      await adminApi.updateSource(token, source.id, { isFeatured: next });
      onRefresh();
    } catch {
      setFeaturedOverrides(o => ({ ...o, [source.id]: current }));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (source: NewsSource) => {
    if (!confirm(`Удалить «${source.name}» из базы данных?`)) return;
    setBusy(source.id);
    try {
      await adminApi.deleteSource(token, source.id);
      onRefresh();
    } catch {
      alert('Ошибка при удалении');
    } finally {
      setBusy(null);
    }
  };

  const openEdit = (source: NewsSource) => { setEditSource(source); setFormOpen(true); };
  const openAdd  = () => { setEditSource(null); setFormOpen(true); };

  return (
    <>
      <div className="monitor-card">
        <div className="monitor-card__header">
          <h3 className="monitor-card__title">Источники</h3>
          <button className="monitor-btn monitor-btn--primary" onClick={openAdd}>+ Добавить</button>
        </div>
        <div className="monitor-table-wrap">
          <table className="monitor-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Регион</th>
                <th>Категория</th>
                <th>Город</th>
                <th>Последний сбор</th>
                <th>Статус</th>
                <th>Витрина</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sources.map(s => {
                const isActive = s.id in overrides ? overrides[s.id] : s.isActive;
                const isFeatured = s.id in featuredOverrides ? featuredOverrides[s.id] : (s.isFeatured ?? false);
                const isSocial = s.sourceType === 'telegram' || s.sourceType === 'youtube';
                return (
                <tr key={s.id}>
                  <td>
                    <a className="monitor-link" href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
                  </td>
                  <td>{s.region}</td>
                  <td>{s.category}</td>
                  <td>{s.city ?? '—'}</td>
                  <td className="monitor-table__muted">
                    {s.lastFetchedAt ? new Date(s.lastFetchedAt).toLocaleString('ru') : '—'}
                  </td>
                  <td>
                    <ToggleSwitch
                      checked={isActive}
                      onChange={() => toggleActive(s)}
                      disabled={busy === s.id}
                    />
                  </td>
                  <td>
                    {isSocial ? (
                      <ToggleSwitch
                        checked={isFeatured}
                        onChange={() => toggleFeatured(s)}
                        disabled={busy === s.id}
                      />
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>—</span>
                    )}
                  </td>
                  <td className="monitor-table__actions">
                    <button className="monitor-btn monitor-btn--icon" onClick={() => openEdit(s)} title="Редактировать">✏️</button>
                    <button className="monitor-btn monitor-btn--icon monitor-btn--danger" onClick={() => handleDelete(s)} disabled={busy === s.id} title="Деактивировать">🗑</button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <SourceForm
          token={token}
          source={editSource}
          onClose={() => setFormOpen(false)}
          onSaved={onRefresh}
        />
      )}
    </>
  );
};
