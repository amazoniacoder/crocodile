import React, { useState, useEffect } from 'react';
import { adminUserTokensApi } from '@/services/adminUserTokensApi';
import { Modal } from '@/ui-system/components/modal/Modal';

interface SubscriptionsModalProps {
  token: string;
  tokenId: number;
  onClose: () => void;
  onUpdate: () => void;
}

interface Channel {
  id: number;
  name: string;
  sourceType: string;
  region: string;
  category: string;
}

export const SubscriptionsModal: React.FC<SubscriptionsModalProps> = ({
  token,
  tokenId,
  onClose,
  onUpdate,
}) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/news/sources', {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      adminUserTokensApi.getTokenSubscriptions(token, tokenId),
    ])
      .then(([{ sources }, { sourceIds }]) => {
        setChannels(
          sources.filter(
            (s: any) => (s.sourceType === 'telegram' || s.sourceType === 'youtube') && s.isActive
          )
        );
        setSelectedIds(new Set(sourceIds));
      })
      .catch((error) => console.error('Failed to load data:', error))
      .finally(() => setLoading(false));
  }, [token, tokenId]);

  const handleToggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelectAll = (channelList: Channel[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      channelList.forEach((c) => next.add(c.id));
      return next;
    });
  };

  const handleDeselectAll = (channelList: Channel[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      channelList.forEach((c) => next.delete(c.id));
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminUserTokensApi.updateTokenSubscriptions(token, tokenId, Array.from(selectedIds));
      onUpdate();
      onClose();
    } catch {
      alert('Ошибка сохранения подписок');
    } finally {
      setSaving(false);
    }
  };

  const filterChannels = (list: Channel[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((c) => c.name.toLowerCase().includes(q));
  };

  const telegramChannels = filterChannels(channels.filter((c) => c.sourceType === 'telegram'));
  const youtubeChannels = filterChannels(channels.filter((c) => c.sourceType === 'youtube'));

  return (
    <Modal isOpen onClose={onClose} title={`Подписки токена #${tokenId}`} size="md">
      <div className="zone-n__subs-modal">
        {loading ? (
          <div className="zone-n__loading">Загрузка...</div>
        ) : (
          <>
            <div className="zone-n__subs-search">
              <input
                type="text"
                className="zone-n__input"
                placeholder="Поиск по названию канала..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {telegramChannels.length > 0 && (
              <div className="zone-n__subs-group">
                <div className="zone-n__subs-group-header">
                  <h4 className="zone-n__subs-group-title">Telegram ({telegramChannels.length})</h4>
                  <div className="zone-n__subs-group-actions">
                    <button
                      className="zone-n__btn-link"
                      onClick={() => handleSelectAll(telegramChannels)}
                    >
                      Выбрать все
                    </button>
                    <button
                      className="zone-n__btn-link"
                      onClick={() => handleDeselectAll(telegramChannels)}
                    >
                      Снять все
                    </button>
                  </div>
                </div>
                <div className="zone-n__subs-list">
                  {telegramChannels.map((channel) => (
                    <label key={channel.id} className="zone-n__subs-item">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(channel.id)}
                        onChange={() => handleToggle(channel.id)}
                      />
                      <span>{channel.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {youtubeChannels.length > 0 && (
              <div className="zone-n__subs-group">
                <div className="zone-n__subs-group-header">
                  <h4 className="zone-n__subs-group-title">YouTube ({youtubeChannels.length})</h4>
                  <div className="zone-n__subs-group-actions">
                    <button
                      className="zone-n__btn-link"
                      onClick={() => handleSelectAll(youtubeChannels)}
                    >
                      Выбрать все
                    </button>
                    <button
                      className="zone-n__btn-link"
                      onClick={() => handleDeselectAll(youtubeChannels)}
                    >
                      Снять все
                    </button>
                  </div>
                </div>
                <div className="zone-n__subs-list">
                  {youtubeChannels.map((channel) => (
                    <label key={channel.id} className="zone-n__subs-item">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(channel.id)}
                        onChange={() => handleToggle(channel.id)}
                      />
                      <span>{channel.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="zone-n__subs-actions">
              <button className="zone-n__btn zone-n__btn--primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button className="zone-n__btn zone-n__btn--secondary" onClick={onClose} disabled={saving}>
                Отмена
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
