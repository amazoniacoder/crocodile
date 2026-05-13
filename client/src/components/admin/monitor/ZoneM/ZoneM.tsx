import React, { useEffect, useState, useCallback } from 'react';
import { Icon } from '@/ui-system/icons/components';

interface YouTubeSource {
  id: number;
  name: string;
  url: string;
  rssUrl: string;
  region: 'russia' | 'world';
  category: string;
  isActive: boolean;
  isFeatured?: boolean;
  isPrivate?: boolean;
  createdAt: string;
}

interface YouTubeStats {
  sourceName: string;
  articlesCount: number;
  lastFetched: string | null;
  oldestArticle: string | null;
  newestArticle: string | null;
}

interface Props {
  token: string;
}

const EMPTY_FORM = { name: '', channelId: '', region: 'world' as 'russia' | 'world', category: 'other' };

const YT_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/>
  </svg>
);

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const extractChannelId = (rssUrl: string): string => {
  const m = rssUrl.match(/channel_id=([^&]+)/);
  return m ? m[1] : '—';
};

const ZoneM: React.FC<Props> = ({ token }) => {
  const [tab, setTab] = useState<'sources' | 'stats'>('sources');
  const [pageEnabled, setPageEnabled] = useState<boolean | null>(null);
  const [togglingPage, setTogglingPage] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [collectResult, setCollectResult] = useState<{ success: boolean; message: string } | null>(null);

  const [sources, setSources] = useState<YouTubeSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [stats, setStats] = useState<YouTubeStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetch('/api/youtube/status')
      .then(r => r.json())
      .then(d => setPageEnabled(d.enabled))
      .catch(() => setPageEnabled(true));
  }, []);

  const collect = async () => {
    setCollecting(true);
    setCollectResult(null);
    try {
      const res = await fetch('/api/admin/jobs/rss-collect', {
        method: 'POST',
        headers,
        body: JSON.stringify({ group: 'youtube' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCollectResult({ success: true, message: `✓ Собрано за ${(data.data.duration / 1000).toFixed(1)} сек` });
        setTimeout(() => setCollectResult(null), 5000);
        loadSources();
      } else {
        setCollectResult({ success: false, message: data.message || 'Ошибка сбора' });
      }
    } catch {
      setCollectResult({ success: false, message: 'Ошибка запроса' });
    } finally {
      setCollecting(false);
    }
  };

  const togglePage = async () => {
    if (pageEnabled === null) return;
    setTogglingPage(true);
    try {
      await fetch('/api/admin/config', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ key: 'youtube_page_enabled', value: String(!pageEnabled) }),
      });
      setPageEnabled(v => !v);
    } finally {
      setTogglingPage(false);
    }
  };

  const loadSources = useCallback(() => {
    setSourcesLoading(true);
    fetch('/api/admin/youtube/sources', { headers })
      .then(r => r.json())
      .then(d => { setSources(d.sources ?? []); setSourcesLoading(false); })
      .catch(() => setSourcesLoading(false));
  }, [token]);

  const loadStats = useCallback(() => {
    setStatsLoading(true);
    fetch('/api/admin/youtube/stats', { headers })
      .then(r => r.json())
      .then(d => { setStats(d.stats ?? []); setStatsLoading(false); })
      .catch(() => setStatsLoading(false));
  }, [token]);

  useEffect(() => {
    if (tab === 'sources') loadSources();
    else loadStats();
  }, [tab, loadSources, loadStats]);

  const addSource = async () => {
    if (!form.name || !form.channelId) {
      setFormError('Заполните название и Channel ID');
      return;
    }
    if (!/^UC[\w-]+$/.test(form.channelId)) {
      setFormError('Channel ID должен начинаться с UC (например: UCHnyfMqiRRG1u-2MsSQLbXA)');
      return;
    }
    setFormError(null);
    const res = await fetch('/api/admin/youtube/sources', {
      method: 'POST',
      headers,
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm(EMPTY_FORM);
      setFormOpen(false);
      loadSources();
    } else {
      const d = await res.json();
      setFormError(d.error ?? 'Ошибка');
    }
  };

  const toggleSource = async (id: number, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/youtube/sources/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || `Ошибка ${res.status}`);
        return;
      }
      loadSources();
    } catch (error) {
      console.error('Toggle source error:', error);
      alert('Ошибка запроса');
    }
  };

  const toggleFeatured = async (id: number, isFeatured: boolean) => {
    try {
      const res = await fetch(`/api/admin/youtube/sources/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isFeatured: !isFeatured }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || `Ошибка ${res.status}`);
        return;
      }
      loadSources();
    } catch (error) {
      console.error('Toggle featured error:', error);
      alert('Ошибка запроса');
    }
  };

  const togglePrivate = async (id: number, isPrivate: boolean) => {
    try {
      const res = await fetch(`/api/admin/youtube/sources/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isPrivate: !isPrivate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || `Ошибка ${res.status}`);
        return;
      }
      loadSources();
    } catch (error) {
      console.error('Toggle private error:', error);
      alert('Ошибка запроса');
    }
  };

  const deleteSource = async (id: number) => {
    if (!confirm('Удалить канал из базы данных? Это действие необратимо.')) return;
    try {
      const res = await fetch(`/api/admin/youtube/sources/${id}`, { method: 'DELETE', headers });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? `Ошибка ${res.status}`);
        return;
      }
      loadSources();
    } catch {
      alert('Ошибка запроса');
    }
  };

  const activeSources = sources.filter(s => s.isActive).length;
  const totalArticles = stats.reduce((sum, s) => sum + s.articlesCount, 0);

  return (
    <div className="monitor-section zone-l">

      {/* Page toggle */}
      <div className="monitor-card zone-l__page-toggle">
        <div className="zone-l__page-toggle-info">
          <span className="zone-l__page-toggle-label">Страница «YouTube»</span>
          <span className={`monitor-badge ${pageEnabled ? 'monitor-badge--green' : 'monitor-badge--red'}`}>
            {pageEnabled === null ? '...' : pageEnabled ? 'Включена' : 'Отключена'}
          </span>
        </div>
        <button
          className={`monitor-btn ${pageEnabled ? 'monitor-btn--danger' : 'monitor-btn--primary'}`}
          onClick={togglePage}
          disabled={togglingPage || pageEnabled === null}
        >
          <Icon name={pageEnabled ? 'eye-off' : 'eye'} size={14} />
          {togglingPage ? ' ...' : pageEnabled ? ' Отключить' : ' Включить'}
        </button>
      </div>

      {/* Tabs */}
      <div className="zone-l__tabs">
        <button
          className={`zone-l__tab ${tab === 'sources' ? 'zone-l__tab--active' : ''}`}
          onClick={() => setTab('sources')}
        >
          <Icon name="satellite" size={16} />
          Каналы ({activeSources}/{sources.length})
        </button>
        <button
          className={`zone-l__tab ${tab === 'stats' ? 'zone-l__tab--active' : ''}`}
          onClick={() => setTab('stats')}
        >
          <Icon name="chart" size={16} />
          Статистика ({totalArticles})
        </button>
      </div>

      {/* Collect button */}
      <div className="monitor-card zone-l__collect-telegram">
        <button
          className="monitor-btn monitor-btn--primary"
          onClick={collect}
          disabled={collecting}
        >
          {collecting ? '⏳ Сбор...' : '▶ Собрать YouTube'}
        </button>
        {collectResult && (
          <span className={`zone-l__collect-result ${collectResult.success ? 'zone-l__collect-result--ok' : 'zone-l__collect-result--error'}`}>
            {collectResult.message}
          </span>
        )}
      </div>

      {/* Sources Tab */}
      {tab === 'sources' && (
        <>
          <div className="monitor-card">
            <div className="zone-l__card-header">
              <h3 className="monitor-card__title">Управление каналами</h3>
              <button
                className="monitor-btn monitor-btn--primary"
                onClick={() => setFormOpen(v => !v)}
              >
                <Icon name={formOpen ? 'x' : 'add'} size={14} />
                {formOpen ? ' Отмена' : ' Добавить канал'}
              </button>
            </div>

            {formOpen && (
              <div className="zone-l__form">
                {formError && <p className="monitor-modal__error">{formError}</p>}
                <div className="zone-l__form-row">
                  <div className="zone-l__field">
                    <label className="zone-l__label">Название канала</label>
                    <input
                      className="monitor-input"
                      placeholder="Veritasium, РБК..."
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="zone-l__field">
                    <label className="zone-l__label">Channel ID (начинается с UC)</label>
                    <input
                      className="monitor-input"
                      placeholder="UCHnyfMqiRRG1u-2MsSQLbXA"
                      value={form.channelId}
                      onChange={e => setForm(f => ({ ...f, channelId: e.target.value.trim() }))}
                    />
                  </div>
                </div>
                <div className="zone-l__form-row">
                  <div className="zone-l__field">
                    <label className="zone-l__label">Регион</label>
                    <select
                      className="monitor-input"
                      value={form.region}
                      onChange={e => setForm(f => ({ ...f, region: e.target.value as 'russia' | 'world' }))}
                    >
                      <option value="russia">Россия</option>
                      <option value="world">Мир</option>
                    </select>
                  </div>
                  <div className="zone-l__field">
                    <label className="zone-l__label">Категория</label>
                    <select
                      className="monitor-input"
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    >
                      <option value="economy">Экономика</option>
                      <option value="tech">Технологии</option>
                      <option value="politics">Политика</option>
                      <option value="society">Общество</option>
                      <option value="other">Другое</option>
                    </select>
                  </div>
                </div>
                <button className="monitor-btn monitor-btn--primary" onClick={addSource}>
                  <Icon name="check" size={14} /> Добавить
                </button>
              </div>
            )}
          </div>

          <div className="monitor-card">
            <div className="zone-l__card-header">
              <h3 className="monitor-card__title">YouTube-каналы</h3>
              <button className="monitor-btn" onClick={loadSources}>
                <Icon name="refresh" size={14} /> Обновить
              </button>
            </div>

            {sourcesLoading ? (
              <p className="monitor-chart__empty">Загрузка...</p>
            ) : sources.length === 0 ? (
              <p className="monitor-chart__empty">Каналов пока нет</p>
            ) : (
              <table className="monitor-table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Channel ID</th>
                    <th>Регион</th>
                    <th>Категория</th>
                    <th>Витрина</th>
                    <th>Приватный</th>
                    <th>Создан</th>
                    <th>Статус</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map(s => (
                    <tr key={s.id}>
                      <td className="monitor-table__td--bold">
                        <a className="monitor-link" href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
                      </td>
                      <td><code style={{ fontSize: '0.8rem' }}>{extractChannelId(s.rssUrl)}</code></td>
                      <td>{s.region === 'russia' ? 'Россия' : 'Мир'}</td>
                      <td>{s.category}</td>
                      <td>
                        <button
                          type="button"
                          className={`monitor-switch ${s.isFeatured ? 'monitor-switch--on' : 'monitor-switch--off'}`}
                          role="switch"
                          aria-checked={!!s.isFeatured}
                          aria-label={s.isFeatured ? 'Убрать с витрины' : 'Сделать витринным'}
                          onClick={() => toggleFeatured(s.id, !!s.isFeatured)}
                        >
                          <span className="monitor-switch__thumb" />
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`monitor-switch ${s.isPrivate ? 'monitor-switch--on' : 'monitor-switch--off'}`}
                          role="switch"
                          aria-checked={!!s.isPrivate}
                          aria-label={s.isPrivate ? 'Сделать публичным' : 'Сделать приватным'}
                          onClick={() => togglePrivate(s.id, !!s.isPrivate)}
                        >
                          <span className="monitor-switch__thumb" />
                        </button>
                      </td>
                      <td>{fmt(s.createdAt)}</td>
                      <td>
                        <span className={`monitor-badge ${s.isActive ? 'monitor-badge--green' : 'monitor-badge--red'}`}>
                          {s.isActive ? 'Активен' : 'Отключён'}
                        </span>
                      </td>
                      <td>
                        <div className="zone-l__actions">
                          <button
                            className="monitor-btn monitor-btn--sm"
                            onClick={() => toggleSource(s.id, s.isActive)}
                            title={s.isActive ? 'Отключить' : 'Включить'}
                          >
                            <Icon name={s.isActive ? 'eye-off' : 'eye'} size={13} />
                          </button>
                          <button
                            className="monitor-btn monitor-btn--sm monitor-btn--danger"
                            onClick={() => deleteSource(s.id)}
                            title="Деактивировать"
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
        </>
      )}

      {/* Stats Tab */}
      {tab === 'stats' && (
        <div className="monitor-card">
          <div className="zone-l__card-header">
            <h3 className="monitor-card__title">Статистика сбора YouTube-каналов</h3>
            <button className="monitor-btn" onClick={loadStats}>
              <Icon name="refresh" size={14} /> Обновить
            </button>
          </div>

          {statsLoading ? (
            <p className="monitor-chart__empty">Загрузка...</p>
          ) : stats.length === 0 ? (
            <div className="monitor-chart__empty">
              <Icon name="info" size={32} />
              <p>Видео ещё не собраны</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                Добавьте каналы и нажмите «Собрать YouTube»
              </p>
            </div>
          ) : (
            <>
              <div className="zone-l__stats-summary">
                <div className="zone-l__stat-card">
                  <Icon name="file" size={24} />
                  <div>
                    <div className="zone-l__stat-value">{totalArticles}</div>
                    <div className="zone-l__stat-label">Всего видео</div>
                  </div>
                </div>
                <div className="zone-l__stat-card">
                  <Icon name="satellite" size={24} />
                  <div>
                    <div className="zone-l__stat-value">{stats.length}</div>
                    <div className="zone-l__stat-label">Активных каналов</div>
                  </div>
                </div>
                <div className="zone-l__stat-card">
                  <Icon name="clock" size={24} />
                  <div>
                    <div className="zone-l__stat-value">
                      {stats[0]?.lastFetched ? fmt(stats[0].lastFetched) : '—'}
                    </div>
                    <div className="zone-l__stat-label">Последний сбор</div>
                  </div>
                </div>
              </div>

              <table className="monitor-table">
                <thead>
                  <tr>
                    <th>Канал</th>
                    <th>Видео</th>
                    <th>Последний сбор</th>
                    <th>Старейшее</th>
                    <th>Новейшее</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s, i) => (
                    <tr key={i}>
                      <td className="monitor-table__td--bold">{s.sourceName}</td>
                      <td><span className="monitor-badge monitor-badge--blue">{s.articlesCount}</span></td>
                      <td>{fmt(s.lastFetched)}</td>
                      <td>{s.oldestArticle ? new Date(s.oldestArticle).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td>{s.newestArticle ? new Date(s.newestArticle).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ZoneM;
