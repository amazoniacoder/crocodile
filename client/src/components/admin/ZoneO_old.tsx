import React, { useState, useEffect } from 'react';
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

interface ZoneOProps {
  adminToken: string;
}

export const ZoneO: React.FC<ZoneOProps> = ({ adminToken }) => {
  const [token, setToken] = useState<AdminToken | null>(null);
  const [channels, setChannels] = useState<PrivateChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    rssUrl: '',
    sourceType: 'telegram' as 'telegram' | 'youtube',
    username: '',
    channelId: '',
  });

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
        setShowAddForm(false);
        setEditingChannel(null);
        setFormData({
          name: '',
          url: '',
          rssUrl: '',
          sourceType: 'telegram',
          username: '',
          channelId: '',
        });
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
    setShowAddForm(true);
  };

  const handleCancelEdit = () => {
    setShowAddForm(false);
    setEditingChannel(null);
    setFormData({
      name: '',
      url: '',
      rssUrl: '',
      sourceType: 'telegram',
      username: '',
      channelId: '',
    });
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

  if (loading) return <div className="zone-loading">Загрузка...</div>;

  return (
    <div className="zone zone-o">
      <h2 className="zone__title">Zone O: Админские каналы</h2>

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
                {copied ? '✓ Скопировано' : 'Копировать'}
              </button>
            </div>
          </div>
        )}
        <div className="zone__hint">
          Используйте этот токен для доступа к приватным каналам на странице /my
        </div>
      </section>

      {/* Приватные каналы */}
      <section className="zone__section">
        <div className="zone__section-header">
          <h3 className="zone__subtitle">Приватные каналы ({channels.length})</h3>
          <button
            className="button button--primary"
            onClick={() => {
              if (showAddForm && !editingChannel) {
                handleCancelEdit();
              } else {
                setShowAddForm(!showAddForm);
              }
            }}
          >
            {showAddForm ? 'Отмена' : '+ Добавить канал'}
          </button>
        </div>

        {showAddForm && (
          <form className="admin-channel-form" onSubmit={handleAddChannel}>
            <h4 className="form-title">{editingChannel ? 'Редактировать канал' : 'Добавить канал'}</h4>
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
            {formData.sourceType === 'telegram' && (
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
            )}
            {formData.sourceType === 'youtube' && (
              <div className="form-row">
                <label className="form-label">
                  Channel ID
                  <input
                    type="text"
                    className="form-input"
                    value={formData.channelId}
                    onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
                    placeholder="UCxxxxxxxxxxxxxxxxxxxx"
                  />
                </label>
              </div>
            )}
            <div className="form-actions">
              <button type="submit" className="button button--primary">
                {editingChannel ? 'Сохранить изменения' : 'Создать приватный канал'}
              </button>
              {editingChannel && (
                <button type="button" className="button button--secondary" onClick={handleCancelEdit}>
                  Отмена
                </button>
              )}
            </div>
          </form>
        )}

        <div className="admin-channels-list">
          {channels.length === 0 ? (
            <div className="zone__empty">Нет приватных каналов</div>
          ) : (
            channels.map((channel) => (
              <div key={channel.id} className="admin-channel-item">
                <div className="admin-channel-item__icon">
                  {channel.sourceType === 'telegram' ? '📱' : '📺'}
                </div>
                <div className="admin-channel-item__info">
                  <div className="admin-channel-item__name">{channel.name}</div>
                  <div className="admin-channel-item__meta">
                    {channel.sourceType === 'telegram' && channel.username && (
                      <span>@{channel.username}</span>
                    )}
                    {channel.sourceType === 'youtube' && channel.channelId && (
                      <span>{channel.channelId}</span>
                    )}
                    <span className="admin-channel-item__badge">
                      🔒 Приватный
                    </span>
                  </div>
                </div>
                <div className="admin-channel-item__actions">
                  <button
                    className="button button--secondary button--sm"
                    onClick={() => handleEditChannel(channel)}
                  >
                    Редактировать
                  </button>
                  <button
                    className="button button--danger button--sm"
                    onClick={() => handleDeleteChannel(channel.id)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
