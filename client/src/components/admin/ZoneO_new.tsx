import React, { useState, useEffect } from 'react';
import { Icon } from '@/ui-system/icons/components';

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
  const [token, setToken] = useState<AdminToken | null>(null);
  const [channels, setChannels] = useState<PrivateChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<number | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  
  const [stats, setStats] = useState<ChannelStats[]>([]);
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
      
      const allStats = [
        ...(tgData.stats ?? []).filter((s: ChannelStats) => privateChannelNames.has(s.sourceName)),
        ...(ytData.stats ?? []).filter((s: ChannelStats) => privateChannelNames.has(s.sourceName)),
      ];
      
      setStats(allStats);
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
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Введите название канала');
      return;
    }

    if (formData.sourceType === 'youtube' && !formData.channelId.trim()) {
      setFormError('Введите Channel ID для YouTube');
      return;
    }

    if (formData.sourceType === 'telegram' && !formData.rssUrl.trim()) {
      setFormError('Введите RSS URL для Telegram');
      return;
    }

    try {
      const url = editingChannel
        ? `/api/admin/admin-channels/sources/${editingChannel}`
        : '/api/admin/admin-channels/sources';
      const method = editingChannel ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowModal(false);
        setEditingChannel(null);
        setFormData(EMPTY_FORM);
        loadData();
      } else {
        const data = await res.json();
        setFormError(data.error || 'Ошибка сохранения');
      }
    } catch (error) {
      setFormError('Ошибка запроса');
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
    setFormError(null);
  };

  const handleDeleteChannel = async (id: number) => {
    if (!confirm('Удалить приватный канал из базы данных? Это действие необратимо.')) return;

    try {
      const res = await fetch(`/api/admin/admin-channels/sources/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (res.ok) {
        loadData();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Ошибка удаления');
      }
    } catch (error) {
      alert('Ошибка запроса');
    }
  };

  const handleManualCollect = async () => {
    setCollecting(true);
    setCollectResult(null);
    
    try {
      const res = await fetch('/api/admin/jobs/rss-collect', {
        method: 'POST',
        headers,
        body: JSON.stringify({ group: 'all' }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setCollectResult({
          success: true,
          message: `Собрано за ${(data.data.duration / 1000).toFixed(1)} сек`,
        });
        setTimeout(() => {
          setCollectResult(null);
          if (activeTab === 'stats') loadStats();
        }, 5000);
      } else {
        setCollectResult({
          success: false,
          message: data.error || data.message || 'Ошибка сбора',
        });
      }
    } catch (error) {
      setCollectResult({
        success: false,
        message: 'Ошибка запроса',
      });
    } finally {
      setCollecting(false);
    }
  };

  const activeChannels = channels.filter(c => c.isActive).length;
  const totalArticles = stats.reduce((sum, s) => sum + s.articlesCount, 0);

  if (loading) return <div className="monitor-chart__empty">Загрузка...</div>;

  return (
    <div className="monitor-section zone-o">
      <h2 className="monitor-section__title">
        <Icon name="lock" size={20} /> Zone O: Приватные каналы
      </h2>

      {/* Админский токен */}
      <div className="monitor-card">
        <h3 className="monitor-card__title">Админский токен (бесрочный)</h3>
        {token && (
          <div className="zone-o__token-card">
            <div className="zone-o__token-info">
              <div className="zone-o__token-label">{token.label}</div>
              <div className="zone-o__token-value">
                <code>{showToken ? token.token : '•'.repeat(67)}</code>
              </div>
              <div className="zone-o__token-meta">
                Создан: {fmt(token.createdAt)}
                {token.lastUsedAt && <> • Использован: {fmt(token.lastUsedAt)}</>}
              </div>
            </div>
            <div className="zone-o__token-actions">
              <button
                className="monitor-btn monitor-btn--sm"
                onClick={() => setShowToken(!showToken)}
              >
                <Icon name={showToken ? 'eye-off' : 'eye'} size={14} />
                {showToken ? ' Скрыть' : ' Показать'}
              </button>
              <button
                className="monitor-btn monitor-btn--sm monitor-btn--primary"
                onClick={copyToken}
              >
                <Icon name="share" size={14} />
                {copied ? ' Скопировано' : ' Копировать'}
              </button>
            </div>
          </div>
        )}
        <p className="monitor-card__hint">
          Используйте этот токен для доступа к приватным каналам на странице /my
        </p>
      </div>

      {/* Кнопка сбора */}
      <div className="monitor-card zone-o__collect">
        <button
          className="monitor-btn monitor-btn--primary"
          onClick={handleManualCollect}
          disabled={collecting}
        >
          {collecting ? <><Icon name="clock" size={14} /> Сбор...</> : <><Icon name="refresh" size={14} /> Собрать все каналы</>}
        </button>
        {collectResult && (
          <span className={`zone-o__collect-result ${collectResult.success ? 'zone-o__collect-result--ok' : 'zone-o__collect-result--error'}`}>
            {collectResult.success ? <Icon name="check" size={14} /> : <Icon name="x" size={14} />}
            {collectResult.message}
          </span>
        )}
      </div>

      {/* Табы */}
      <div className="zone-l__tabs">
        <button
          className={`zone-l__tab ${activeTab === 'channels' ? 'zone-l__tab--active' : ''}`}
          onClick={() => setActiveTab('channels')}
        >
          <Icon name="satellite" size={16} />
          Каналы ({activeChannels}/{channels.length})
        </button>
        <button
          className={`zone-l__tab ${activeTab === 'stats' ? 'zone-l__tab--active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <Icon name="chart" size={16} />
          Статистика ({totalArticles})
        </button>
      </div>

      {activeTab === 'channels' ? (
        /* Вкладка Каналы */
        <div className="monitor-card">
          <div className="zone-l__card-header">
            <h3 className="monitor-card__title">Управление приватными каналами</h3>
            <button
              className="monitor-btn monitor-btn--primary"
              onClick={() => {
                setEditingChannel(null);
                setFormData(EMPTY_FORM);
                setShowModal(true);
              }}
            >
              <Icon name="add" size={14} /> Добавить канал
            </button>
          </div>

          {channels.length === 0 ? (
            <p className="monitor-chart__empty">Приватных каналов пока нет</p>
          ) : (
            <table className="monitor-table">
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>Название</th>
                  <th>Идентификатор</th>
                  <th>URL</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {channels.map(channel => (
                  <tr key={channel.id}>
                    <td>
                      <Icon name={channel.sourceType === 'telegram' ? 'telegram' : 'youtube'} size={16} />
                      {channel.sourceType === 'telegram' ? 'Telegram' : 'YouTube'}
                    </td>
                    <td className="monitor-table__td--bold">
                      <a className="monitor-link" href={channel.url} target="_blank" rel="noreferrer">
                        {channel.name}
                      </a>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.8rem' }}>
                        {channel.sourceType === 'telegram' 
                          ? (channel.username ? `@${channel.username}` : '—')
                          : (channel.channelId || '—')
                        }
                      </code>
                    </td>
                    <td>
                      <a className="monitor-link" href={channel.rssUrl} target="_blank" rel="noreferrer" title="RSS URL">
                        <Icon name="share" size={14} />
                      </a>
                    </td>
                    <td>
                      <span className={`monitor-badge ${channel.isActive ? 'monitor-badge--green' : 'monitor-badge--red'}`}>
                        {channel.isActive ? 'Активен' : 'Отключён'}
                      </span>
                    </td>
                    <td>
                      <div className="zone-l__actions">
                        <button
                          className="monitor-btn monitor-btn--sm"
                          onClick={() => handleEditChannel(channel)}
                          title="Редактировать"
                        >
                          <Icon name="edit" size={13} />
                        </button>
                        <button
                          className="monitor-btn monitor-btn--sm monitor-btn--danger"
                          onClick={() => handleDeleteChannel(channel.id)}
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
      ) : (
        /* Вкладка Статистика */
        <div className="monitor-card">
          <div className="zone-l__card-header">
            <h3 className="monitor-card__title">Статистика приватных каналов</h3>
            <button className="monitor-btn" onClick={loadStats} disabled={statsLoading}>
              <Icon name="refresh" size={14} /> Обновить
            </button>
          </div>

          {statsLoading ? (
            <p className="monitor-chart__empty">Загрузка...</p>
          ) : stats.length === 0 ? (
            <div className="monitor-chart__empty">
              <Icon name="info" size={32} />
              <p>Статистика пока недоступна</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                Добавьте приватные каналы и запустите сбор
              </p>
            </div>
          ) : (
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
          )}
        </div>
      )}

      {/* Модальное окно */}
      {showModal && (
        <div className="monitor-modal" onClick={handleCancelEdit}>
          <div className="monitor-modal__content" onClick={e => e.stopPropagation()}>
            <div className="monitor-modal__header">
              <h3 className="monitor-modal__title">
                {editingChannel ? 'Редактировать канал' : 'Добавить приватный канал'}
              </h3>
              <button className="monitor-modal__close" onClick={handleCancelEdit}>
                <Icon name="x" size={20} />
              </button>
            </div>
            <form className="monitor-modal__form" onSubmit={handleAddChannel}>
              {formError && <p className="monitor-modal__error">{formError}</p>}
              
              <div className="monitor-modal__field">
                <label className="monitor-modal__label">
                  Тип канала
                  <select
                    className="monitor-input"
                    value={formData.sourceType}
                    onChange={(e) => setFormData({ ...formData, sourceType: e.target.value as 'telegram' | 'youtube' })}
                  >
                    <option value="telegram">Telegram</option>
                    <option value="youtube">YouTube</option>
                  </select>
                </label>
              </div>

              <div className="monitor-modal__field">
                <label className="monitor-modal__label">
                  Название канала
                  <input
                    type="text"
                    className="monitor-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Название канала"
                    required
                  />
                </label>
              </div>

              <div className="monitor-modal__field">
                <label className="monitor-modal__label">
                  URL канала
                  <input
                    type="url"
                    className="monitor-input"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder={formData.sourceType === 'telegram' ? 'https://t.me/channel' : 'https://youtube.com/@channel'}
                    required
                  />
                </label>
              </div>

              {formData.sourceType === 'telegram' && (
                <>
                  <div className="monitor-modal__field">
                    <label className="monitor-modal__label">
                      RSS URL
                      <input
                        type="url"
                        className="monitor-input"
                        value={formData.rssUrl}
                        onChange={(e) => setFormData({ ...formData, rssUrl: e.target.value })}
                        placeholder="https://rsshub.app/telegram/channel/..."
                        required
                      />
                    </label>
                  </div>
                  <div className="monitor-modal__field">
                    <label className="monitor-modal__label">
                      Username (без @)
                      <input
                        type="text"
                        className="monitor-input"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        placeholder="channel"
                      />
                    </label>
                  </div>
                </>
              )}

              {formData.sourceType === 'youtube' && (
                <div className="monitor-modal__field">
                  <label className="monitor-modal__label">
                    Channel ID
                    <input
                      type="text"
                      className="monitor-input"
                      value={formData.channelId}
                      onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
                      placeholder="UCxxxxxxxxxxxxxxxxxxxx"
                      required
                    />
                  </label>
                  <p className="monitor-modal__hint">
                    RSS URL будет сгенерирован автоматически из Channel ID
                  </p>
                </div>
              )}

              <div className="monitor-modal__actions">
                <button type="submit" className="monitor-btn monitor-btn--primary">
                  <Icon name="check" size={14} />
                  {editingChannel ? ' Сохранить' : ' Создать'}
                </button>
                <button type="button" className="monitor-btn" onClick={handleCancelEdit}>
                  <Icon name="x" size={14} /> Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};