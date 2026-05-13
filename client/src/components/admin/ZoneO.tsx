import React, { useState, useEffect } from 'react';
import { Icon } from '@/ui-system/icons/components';
import { ToggleSwitch } from './monitor/ToggleSwitch';
import './ZoneO.css';

interface AdminToken {
  id: number;
  token: string;
  label: string | null;
  isActive: boolean;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

interface PrivateChannel {
  id: number;
  name: string;
  sourceType: 'telegram' | 'youtube';
  url: string;
  rssUrl: string;
  username?: string | null;
  channelId?: string | null;
  isActive: boolean;
  adminTokenIds: number[];
}

interface ChannelStats {
  sourceName: string;
  articlesCount: number;
  lastFetched: string | null;
  oldestArticle: string | null;
  newestArticle: string | null;
}

interface ZoneOProps {
  adminToken: string;
}

const EMPTY_FORM = {
  name: '',
  url: '',
  rssUrl: '',
  sourceType: 'telegram' as 'telegram' | 'youtube',
  username: '',
  channelId: '',
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

export const ZoneO: React.FC<ZoneOProps> = ({ adminToken }) => {
  const [activeTab, setActiveTab] = useState<'channels' | 'stats'>('channels');
  const [channelType, setChannelType] = useState<'telegram' | 'youtube'>('telegram');
  const [token, setToken] = useState<AdminToken | null>(null);
  const [channels, setChannels] = useState<PrivateChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<number | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  
  const [stats, setStats] = useState<{ telegram: ChannelStats[]; youtube: ChannelStats[] }>({ telegram: [], youtube: [] });
  const [statsLoading, setStatsLoading] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [collectResult, setCollectResult] = useState<{ success: boolean; message: string } | null>(null);

  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tokenRes, channelsRes] = await Promise.all([
        fetch('/api/admin/admin-channels/token', {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        fetch('/api/admin/admin-channels/sources', {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
      ]);

      const tokenData = await tokenRes.json();
      const channelsData = await channelsRes.json();

      if (tokenData.success) setToken(tokenData.token);
      if (channelsData.success) setChannels(channelsData.sources);
    } catch (error) {
      console.error('Failed to load admin channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const [tgRes, ytRes] = await Promise.all([
        fetch('/api/admin/telegram/stats', { headers }),
        fetch('/api/admin/youtube/stats', { headers }),
      ]);
      const [tgData, ytData] = await Promise.all([tgRes.json(), ytRes.json()]);
      
      const privateChannelNames = new Set(channels.filter(c => c.isActive).map(c => c.name));
      
      setStats({
        telegram: (tgData.stats ?? []).filter((s: ChannelStats) => privateChannelNames.has(s.sourceName)),
        youtube: (ytData.stats ?? []).filter((s: ChannelStats) => privateChannelNames.has(s.sourceName)),
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'stats' && channels.length > 0) {
      loadStats();
    }
  }, [activeTab, channels]);

  const copyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingChannel
        ? `/api/admin/admin-channels/sources/${editingChannel}`
        : '/api/admin/admin-channels/sources';
      const method = editingChannel ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowModal(false);
        setEditingChannel(null);
        setFormData(EMPTY_FORM);
        loadData();
      }
    } catch (error) {
      console.error('Failed to save channel:', error);
    }
  };

  const handleEditChannel = (channel: PrivateChannel) => {
    setEditingChannel(channel.id);
    setFormData({
      name: channel.name,
      url: channel.url,
      rssUrl: channel.rssUrl,
      sourceType: channel.sourceType,
      username: channel.username || '',
      channelId: channel.channelId || '',
    });
    setShowModal(true);
  };

  const handleCancelEdit = () => {
    setShowModal(false);
    setEditingChannel(null);
    setFormData(EMPTY_FORM);
  };

  const handleDeleteChannel = async (id: number) => {
    if (!confirm('Удалить приватный канал?')) return;

    try {
      const res = await fetch(`/api/admin/admin-channels/sources/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (res.ok) loadData();
    } catch (error) {
      console.error('Failed to delete channel:', error);
    }
  };

  const handleManualCollect = async () => {
    console.log('[Zone O] Starting manual collect...');
    setCollecting(true);
    setCollectResult(null);
    
    try {
      console.log('[Zone O] Sending request to /api/admin/jobs/rss-collect');
      const res = await fetch('/api/admin/jobs/rss-collect', {
        method: 'POST',
        headers,
        body: JSON.stringify({ group: 'all' }),
      });
      
      console.log('[Zone O] Response status:', res.status);
      const data = await res.json();
      console.log('[Zone O] Response data:', data);
      
      if (res.ok && data.success) {
        setCollectResult({
          success: true,
          message: `✓ Собрано за ${(data.data.duration / 1000).toFixed(1)} сек`,
        });
        setTimeout(() => {
          setCollectResult(null);
          if (activeTab === 'stats') loadStats();
        }, 3000);
      } else {
        console.error('[Zone O] Collection failed:', data);
        setCollectResult({
          success: false,
          message: data.error || data.message || 'Ошибка сбора',
        });
      }
    } catch (error) {
      console.error('[Zone O] Request error:', error);
      setCollectResult({
        success: false,
        message: 'Ошибка запроса',
      });
    } finally {
      setCollecting(false);
    }
  };

  const telegramChannels = channels.filter(c => c.sourceType === 'telegram');
  const youtubeChannels = channels.filter(c => c.sourceType === 'youtube');
  
  // Calculate total articles from stats, but only if stats have been loaded
  const totalArticles = React.useMemo(() => {
    if (activeTab === 'stats' && (stats.telegram.length > 0 || stats.youtube.length > 0)) {
      return stats.telegram.reduce((sum, s) => sum + s.articlesCount, 0) + 
             stats.youtube.reduce((sum, s) => sum + s.articlesCount, 0);
    }
    return 0;
  }, [stats, activeTab]);

  const toggleChannelActive = async (channel: PrivateChannel) => {
    try {
      const res = await fetch(`/api/admin/admin-channels/sources/${channel.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ ...channel, isActive: !channel.isActive }),
      });

      if (res.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Failed to toggle channel:', error);
    }
  };

  if (loading) return <div className="zone-loading">Загрузка...</div>;

  const daysLeft = token?.expiresAt
    ? Math.ceil((new Date(token.expiresAt).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="zone zone-o">

      {/* Админский токен */}
      <section className="zone__section">
        <h3 className="zone__subtitle">Админский токен (бесрочный)</h3>
        {token && (
          <div className="admin-token-card">
            <div className="admin-token-card__info">
              <div className="admin-token-card__label">{token.label}</div>
              <div className="admin-token-card__token">
                {showToken ? token.token : '•'.repeat(67)}
              </div>
              <div className="admin-token-card__meta">
                Создан: {new Date(token.createdAt).toLocaleString('ru-RU')}
                {token.lastUsedAt && (
                  <> • Последнее использование: {new Date(token.lastUsedAt).toLocaleString('ru-RU')}</>
                )}
              </div>
            </div>
            <div className="admin-token-card__actions">
              <button
                className="button button--secondary"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? 'Скрыть' : 'Показать'}
              </button>
              <button
                className="button button--primary"
                onClick={copyToken}
              >
                {copied ? (
              <>
                <Icon name="check" size={14} />
                Скопировано
              </>
            ) : (
              <>
                <Icon name="share" size={14} />
                Копировать
              </>
            )}
              </button>
            </div>
          </div>
        )}
        <div className="zone__hint">
          Используйте этот токен для доступа к приватным каналам на странице /my
        </div>
      </section>

      {/* Кнопка ручного сбора */}
      <div className="zone-o__collect">
        <button
          className="button button--primary"
          onClick={handleManualCollect}
          disabled={collecting}
        >
          {collecting ? (
          <>
            <Icon name="clock" size={16} />
            Сбор...
          </>
        ) : (
          <>
            <Icon name="refresh" size={16} />
            Ручной сбор RSS
          </>
        )}
        </button>
        {collectResult && (
          <span className={`zone-o__collect-result ${collectResult.success ? 'zone-o__collect-result--ok' : 'zone-o__collect-result--error'}`}>
            <Icon name={collectResult.success ? 'check' : 'error'} size={14} />
            {collectResult.message}
          </span>
        )}
        <div className="zone__hint">
          Запускает сбор всех активных источников, включая приватные каналы
        </div>
      </div>

      {/* Табы */}
      <div className="zone-o__tabs">
        <button
          className={`zone-o__tab ${activeTab === 'channels' ? 'zone-o__tab--active' : ''}`}
          onClick={() => setActiveTab('channels')}
        >
          <Icon name="satellite" size={16} />
          Каналы ({channels.length})
        </button>
        <button
          className={`zone-o__tab ${activeTab === 'stats' ? 'zone-o__tab--active' : ''}`}
          onClick={() => {
            setActiveTab('stats');
            if (channels.length > 0) {
              loadStats();
            }
          }}
        >
          <Icon name="chart" size={16} />
          Статистика {activeTab === 'stats' && !statsLoading ? `(${totalArticles})` : ''}
        </button>
      </div>

      {activeTab === 'channels' ? (
        /* Вкладка Каналы */
        <>
          {/* Подвкладки Telegram/YouTube */}
          <div className="zone-o__subtabs">
            <button
              className={`zone-o__subtab ${channelType === 'telegram' ? 'zone-o__subtab--active' : ''}`}
              onClick={() => setChannelType('telegram')}
            >
              <Icon name="telegram" size={16} />
              Telegram ({telegramChannels.length})
            </button>
            <button
              className={`zone-o__subtab ${channelType === 'youtube' ? 'zone-o__subtab--active' : ''}`}
              onClick={() => setChannelType('youtube')}
            >
              <Icon name="youtube" size={16} />
              YouTube ({youtubeChannels.length})
            </button>
          </div>

          <section className="zone__section">
            <div className="zone__section-header">
              <h3 className="zone__subtitle">
                {channelType === 'telegram' ? 'Telegram-каналы' : 'YouTube-каналы'} ({channelType === 'telegram' ? telegramChannels.length : youtubeChannels.length})
              </h3>
              <button
                className="button button--primary"
                onClick={() => {
                  setEditingChannel(null);
                  setFormData({ ...EMPTY_FORM, sourceType: channelType });
                  setShowModal(true);
                }}
              >
                + Добавить канал
              </button>
            </div>

            <div className="monitor-table-wrap">
              <table className="monitor-table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Тип</th>
                    <th>Идентификатор</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {(channelType === 'telegram' ? telegramChannels : youtubeChannels).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="zone__empty">Нет {channelType === 'telegram' ? 'Telegram' : 'YouTube'}-каналов</td>
                    </tr>
                  ) : (
                    (channelType === 'telegram' ? telegramChannels : youtubeChannels).map((channel) => (
                      <tr key={channel.id}>
                        <td>
                          <a className="monitor-link" href={channel.url} target="_blank" rel="noreferrer">
                            {channel.name}
                          </a>
                        </td>
                        <td>
                          <div className="admin-channel-type">
                            <Icon name={channel.sourceType} size={16} />
                            {channel.sourceType === 'telegram' ? 'Telegram' : 'YouTube'}
                          </div>
                        </td>
                        <td className="monitor-table__muted">
                          {channel.sourceType === 'telegram' && channel.username ? (
                            `@${channel.username}`
                          ) : channel.sourceType === 'youtube' && channel.channelId ? (
                            channel.channelId
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <ToggleSwitch
                            checked={channel.isActive}
                            onChange={() => toggleChannelActive(channel)}
                          />
                        </td>
                        <td className="monitor-table__actions">
                          <button
                            className="monitor-btn monitor-btn--icon"
                            onClick={() => handleEditChannel(channel)}
                            title="Редактировать"
                          >
                            <Icon name="edit" size={16} />
                          </button>
                          <button
                            className="monitor-btn monitor-btn--icon monitor-btn--danger"
                            onClick={() => handleDeleteChannel(channel.id)}
                            title="Удалить"
                          >
                            <Icon name="delete" size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        /* Вкладка Статистика */
        <>
          <section className="zone__section">
            <div className="zone__section-header">
              <h3 className="zone__subtitle">Статистика Telegram ({stats.telegram.length})</h3>
              <button className="button button--secondary" onClick={loadStats} disabled={statsLoading}>
                <Icon name="refresh" size={14} /> Обновить
              </button>
            </div>

            {statsLoading ? (
              <div className="zone__loading">Загрузка...</div>
            ) : stats.telegram.length === 0 ? (
              <div className="zone__empty">Нет данных по Telegram-каналам</div>
            ) : (
              <div className="monitor-table-wrap">
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
                    {stats.telegram.map((s, i) => (
                      <tr key={i}>
                        <td className="monitor-table__name">{s.sourceName}</td>
                        <td>
                          <span className="zone-badge zone-badge--blue">{s.articlesCount}</span>
                        </td>
                        <td className="monitor-table__muted">{fmt(s.lastFetched)}</td>
                        <td className="monitor-table__muted">{s.oldestArticle ? new Date(s.oldestArticle).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td className="monitor-table__muted">{s.newestArticle ? new Date(s.newestArticle).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="zone__section">
            <div className="zone__section-header">
              <h3 className="zone__subtitle">Статистика YouTube ({stats.youtube.length})</h3>
            </div>

            {statsLoading ? (
              <div className="zone__loading">Загрузка...</div>
            ) : stats.youtube.length === 0 ? (
              <div className="zone__empty">Нет данных по YouTube-каналам</div>
            ) : (
              <div className="monitor-table-wrap">
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
                    {stats.youtube.map((s, i) => (
                      <tr key={i}>
                        <td className="monitor-table__name">{s.sourceName}</td>
                        <td>
                          <span className="zone-badge zone-badge--blue">{s.articlesCount}</span>
                        </td>
                        <td className="monitor-table__muted">{fmt(s.lastFetched)}</td>
                        <td className="monitor-table__muted">{s.oldestArticle ? new Date(s.oldestArticle).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td className="monitor-table__muted">{s.newestArticle ? new Date(s.newestArticle).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* Модальное окно */}
      {showModal && (
        <div className="zone-modal" onClick={handleCancelEdit}>
          <div className="zone-modal__content" onClick={e => e.stopPropagation()}>
            <div className="zone-modal__header">
              <h3 className="zone-modal__title">{editingChannel ? 'Редактировать канал' : 'Добавить канал'}</h3>
              <button className="zone-modal__close" onClick={handleCancelEdit}>
                <Icon name="x" size={20} />
              </button>
            </div>
            <form className="admin-channel-form" onSubmit={handleAddChannel}>
              <div className="form-row">
                <label className="form-label">
                  Тип канала
                  <select
                    className="form-select"
                    value={formData.sourceType}
                    onChange={(e) => setFormData({ ...formData, sourceType: e.target.value as 'telegram' | 'youtube' })}
                  >
                    <option value="telegram">Telegram</option>
                    <option value="youtube">YouTube</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label className="form-label">
                  Название
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </label>
              </div>
              <div className="form-row">
                <label className="form-label">
                  URL канала
                  <input
                    type="url"
                    className="form-input"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder={formData.sourceType === 'telegram' ? 'https://t.me/channel' : 'https://youtube.com/@channel'}
                    required
                  />
                </label>
              </div>
              {formData.sourceType === 'telegram' && (
                <>
                  <div className="form-row">
                    <label className="form-label">
                      RSS URL
                      <input
                        type="url"
                        className="form-input"
                        value={formData.rssUrl}
                        onChange={(e) => setFormData({ ...formData, rssUrl: e.target.value })}
                        required
                      />
                    </label>
                  </div>
                  <div className="form-row">
                    <label className="form-label">
                      Username (без @)
                      <input
                        type="text"
                        className="form-input"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        placeholder="channel"
                      />
                    </label>
                  </div>
                </>
              )}
              {formData.sourceType === 'youtube' && (
                <>
                  <div className="form-row">
                    <label className="form-label">
                      Channel ID *
                      <input
                        type="text"
                        className="form-input"
                        value={formData.channelId}
                        onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
                        placeholder="UCxxxxxxxxxxxxxxxxxxxx"
                        required
                      />
                    </label>
                  </div>
                  <div className="zone__hint">
                    RSS URL будет сгенерирован автоматически из Channel ID
                  </div>
                </>
              )}
              <div className="form-actions">
                <button type="submit" className="button button--primary">
                  {editingChannel ? 'Сохранить изменения' : 'Создать приватный канал'}
                </button>
                <button type="button" className="button button--secondary" onClick={handleCancelEdit}>
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
