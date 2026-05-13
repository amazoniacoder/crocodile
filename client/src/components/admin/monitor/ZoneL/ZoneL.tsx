import React, { useEffect, useState, useCallback } from 'react';
import { Icon } from '@/ui-system/icons/components';

interface TelegramSource {
  id: number;
  name: string;
  channelUsername: string;
  region: 'russia' | 'world';
  category: string;
  isActive: boolean;
  createdAt: string;
}

interface TelegramStats {
  sourceName: string;
  articlesCount: number;
  lastFetched: string | null;
  oldestArticle: string | null;
  newestArticle: string | null;
}

interface Props {
  token: string;
}

const EMPTY_SOURCE_FORM: { name: string; channelUsername: string; region: 'russia' | 'world'; category: string } = {
  name: '',
  channelUsername: '',
  region: 'world',
  category: 'other',
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const ZoneL: React.FC<Props> = ({ token }) => {
  const [tab, setTab] = useState<'sources' | 'stats'>('sources');
  const [pageEnabled, setPageEnabled] = useState<boolean | null>(null);
  const [togglingPage, setTogglingPage] = useState(false);
  const [collectingTelegram, setCollectingTelegram] = useState(false);
  const [collectResult, setCollectResult] = useState<{ success: boolean; message: string } | null>(null);

  const [sources, setSources] = useState<TelegramSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourceForm, setSourceForm] = useState(EMPTY_SOURCE_FORM);
  const [sourceFormOpen, setSourceFormOpen] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const [stats, setStats] = useState<TelegramStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetch('/api/telegram/status')
      .then(r => r.json())
      .then(d => setPageEnabled(d.enabled))
      .catch(() => setPageEnabled(true));
  }, []);

  const collectTelegram = async () => {
    setCollectingTelegram(true);
    setCollectResult(null);
    try {
      const res = await fetch('/api/admin/jobs/rss-collect', {
        method: 'POST',
        headers,
        body: JSON.stringify({ group: 'telegram' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCollectResult({ success: true, message: `✓ Собрано за ${(data.data.duration / 1000).toFixed(1)} сек` });
        setTimeout(() => setCollectResult(null), 5000);
      } else {
        setCollectResult({ success: false, message: data.message || 'Ошибка сбора' });
      }
    } catch {
      setCollectResult({ success: false, message: 'Ошибка запроса' });
    } finally {
      setCollectingTelegram(false);
    }
  };

  const togglePage = async () => {
    if (pageEnabled === null) return;
    setTogglingPage(true);
    try {
      await fetch('/api/admin/config', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ key: 'telegram_page_enabled', value: String(!pageEnabled) }),
      });
      setPageEnabled(v => !v);
    } finally {
      setTogglingPage(false);
    }
  };

  const loadSources = useCallback(() => {
    setSourcesLoading(true);
    fetch('/api/admin/telegram/sources', { headers })
      .then(r => r.json())
      .then(d => { setSources(d.sources ?? []); setSourcesLoading(false); })
      .catch(() => setSourcesLoading(false));
  }, [token]);

  const loadStats = useCallback(() => {
    setStatsLoading(true);
    fetch('/api/admin/telegram/stats', { headers })
      .then(r => r.json())
      .then(d => { setStats(d.stats ?? []); setStatsLoading(false); })
      .catch(() => setStatsLoading(false));
  }, [token]);

  useEffect(() => {
    if (tab === 'sources') loadSources();
    else if (tab === 'stats') loadStats();
  }, [tab, loadSources, loadStats]);

  const addSource = async () => {
    if (!sourceForm.name || !sourceForm.channelUsername) {
      setSourceError('Заполните название и username канала');
      return;
    }
    setSourceError(null);
    const res = await fetch('/api/admin/telegram/sources', {
      method: 'POST',
      headers,
      body: JSON.stringify(sourceForm),
    });
    if (res.ok) {
      setSourceForm(EMPTY_SOURCE_FORM);
      setSourceFormOpen(false);
      loadSources();
    } else {
      const d = await res.json();
      setSourceError(d.error ?? 'Ошибка');
    }
  };

  const toggleSource = async (id: number, isActive: boolean) => {
    await fetch(`/api/admin/telegram/sources/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ isActive: !isActive }),
    });
    loadSources();
  };

  const deleteSource = async (id: number) => {
    if (!confirm('Удалить канал из базы данных?')) return;
    try {
      const res = await fetch(`/api/admin/telegram/sources/${id}`, { method: 'DELETE', headers });
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
          <span className="zone-l__page-toggle-label">Страница «Соц. сети»</span>
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
          Источники ({activeSources}/{sources.length})
        </button>
        <button
          className={`zone-l__tab ${tab === 'stats' ? 'zone-l__tab--active' : ''}`}
          onClick={() => setTab('stats')}
        >
          <Icon name="chart" size={16} />
          Статистика ({totalArticles})
        </button>
      </div>

      {/* Collect Telegram Button */}
      <div className="monitor-card zone-l__collect-telegram">
        <button
          className="monitor-btn monitor-btn--primary"
          onClick={collectTelegram}
          disabled={collectingTelegram}
        >
          {collectingTelegram ? '⏳ Сбор...' : '▶ Собрать Telegram'}
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
              <h3 className="monitor-card__title">Управление источниками</h3>
              <button
                className="monitor-btn monitor-btn--primary"
                onClick={() => setSourceFormOpen(v => !v)}
              >
                <Icon name={sourceFormOpen ? 'x' : 'add'} size={14} />
                {sourceFormOpen ? ' Отмена' : ' Добавить канал'}
              </button>
            </div>

            {sourceFormOpen && (
              <div className="zone-l__form">
                {sourceError && <p className="monitor-modal__error">{sourceError}</p>}
                <div className="zone-l__form-row">
                  <div className="zone-l__field">
                    <label className="zone-l__label">Название канала</label>
                    <input
                      className="monitor-input"
                      placeholder="Медуза, РБК..."
                      value={sourceForm.name}
                      onChange={e => setSourceForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="zone-l__field">
                    <label className="zone-l__label">Username (без @)</label>
                    <input
                      className="monitor-input"
                      placeholder="meduzalive"
                      value={sourceForm.channelUsername}
                      onChange={e => setSourceForm(f => ({ ...f, channelUsername: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="zone-l__form-row">
                  <div className="zone-l__field">
                    <label className="zone-l__label">Регион</label>
                    <select
                      className="monitor-input"
                      value={sourceForm.region}
                      onChange={e => setSourceForm(f => ({ ...f, region: e.target.value as 'russia' | 'world' }))}
                    >
                      <option value="russia">Россия</option>
                      <option value="world">Мир</option>
                    </select>
                  </div>
                  <div className="zone-l__field">
                    <label className="zone-l__label">Категория</label>
                    <select
                      className="monitor-input"
                      value={sourceForm.category}
                      onChange={e => setSourceForm(f => ({ ...f, category: e.target.value }))}
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
              <h3 className="monitor-card__title">Telegram-каналы</h3>
              <button className="monitor-btn" onClick={loadSources}>
                <Icon name="refresh" size={14} /> Обновить
              </button>
            </div>

            {sourcesLoading ? (
              <p className="monitor-chart__empty">Загрузка...</p>
            ) : sources.length === 0 ? (
              <p className="monitor-chart__empty">Источников пока нет</p>
            ) : (
              <table className="monitor-table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Username</th>
                    <th>Регион</th>
                    <th>Категория</th>
                    <th>Создан</th>
                    <th>Статус</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map(s => (
                    <tr key={s.id}>
                      <td className="monitor-table__td--bold">{s.name}</td>
                      <td><code style={{ fontSize: '0.85rem' }}>@{s.channelUsername}</code></td>
                      <td>{s.region === 'russia' ? 'Россия' : 'Мир'}</td>
                      <td>{s.category}</td>
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
        </>
      )}

      {/* Stats Tab */}
      {tab === 'stats' && (
        <div className="monitor-card">
          <div className="zone-l__card-header">
            <h3 className="monitor-card__title">Статистика сбора Telegram-каналов</h3>
            <button className="monitor-btn" onClick={loadStats}>
              <Icon name="refresh" size={14} /> Обновить
            </button>
          </div>

          {statsLoading ? (
            <p className="monitor-chart__empty">Загрузка...</p>
          ) : stats.length === 0 ? (
            <div className="monitor-chart__empty">
              <Icon name="info" size={32} />
              <p>Статьи ещё не собраны</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                Запустите ручной сбор в Zone C или дождитесь автоматического сбора
              </p>
            </div>
          ) : (
            <>
              <div className="zone-l__stats-summary">
                <div className="zone-l__stat-card">
                  <Icon name="file" size={24} />
                  <div>
                    <div className="zone-l__stat-value">{totalArticles}</div>
                    <div className="zone-l__stat-label">Всего статей</div>
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
                    <th>Статей</th>
                    <th>Последний сбор</th>
                    <th>Старейшая</th>
                    <th>Новейшая</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s, i) => (
                    <tr key={i}>
                      <td className="monitor-table__td--bold">{s.sourceName}</td>
                      <td>
                        <span className="monitor-badge monitor-badge--blue">{s.articlesCount}</span>
                      </td>
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

export default ZoneL;
