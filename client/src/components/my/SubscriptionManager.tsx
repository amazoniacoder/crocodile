import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { myApi, type AvailableChannel } from '@/services/myApi';
import { Switch } from '@/ui-system/components';
import { NewsSearch } from '@/components/news/NewsSearch';

interface SubscriptionManagerProps {
  token: string;
  onClose: () => void;
  onUpdate: (selectedIds: Set<number>) => void;
  activeTab: 'all' | 'telegram' | 'youtube' | 'bookmarks';
  onTabChange: (tab: 'all' | 'telegram' | 'youtube' | 'bookmarks') => void;
  filters: { search: string; dateFrom: string; dateTo: string; };
  onFiltersChange: (filters: { search: string; dateFrom: string; dateTo: string; }) => void;
  onFiltersReset: () => void;
}

export const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({
  token,
  onClose,
  onUpdate,
  activeTab,
  onTabChange,
  filters,
  onFiltersChange,
  onFiltersReset,
}) => {
  const [, navigate] = useLocation();
  const [channels, setChannels] = useState<AvailableChannel[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelTab, setChannelTab] = useState<'public' | 'private'>('public');

  useEffect(() => {
    Promise.all([
      myApi.getAvailableChannels(token),
      myApi.getSubscriptions(token),
    ])
      .then(([{ channels: availableChannels }, { sourceIds }]) => {
        setChannels(availableChannels);
        setSelectedIds(new Set(sourceIds));
      })
      .catch((error) => {
        console.error('Failed to load channels:', error);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleToggle = async (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
    try {
      await myApi.updateSubscriptions(token, Array.from(next));
      onUpdate(next);
    } catch (error) {
      console.error('Failed to save subscriptions:', error);
      // Откатываем изменения при ошибке
      setSelectedIds(selectedIds);
    }
  };

  const handleToggleAll = async (sourceType: 'telegram' | 'youtube', enable: boolean) => {
    // Получаем каналы текущего типа с учетом фильтрации по приватности
    const channelsOfType = channels.filter(c => {
      if (c.sourceType !== sourceType) return false;
      if (activeTab === 'youtube' && channelTab === 'private') {
        return c.isPrivate === true;
      }
      if (activeTab === 'youtube' && channelTab === 'public') {
        return c.isPrivate !== true;
      }
      return true;
    });
    
    const next = new Set(selectedIds);
    
    channelsOfType.forEach(channel => {
      if (enable) {
        next.add(channel.id);
      } else {
        next.delete(channel.id);
      }
    });
    
    setSelectedIds(next);
    try {
      await myApi.updateSubscriptions(token, Array.from(next));
      onUpdate(next);
    } catch (error) {
      console.error('Failed to save subscriptions:', error);
      setSelectedIds(selectedIds);
    }
  };

  const getSearchPlaceholder = () => {
    switch (activeTab) {
      case 'telegram': return 'Поиск по Telegram-каналам...';
      case 'youtube': return 'Поиск по YouTube-каналам...';
      case 'bookmarks': return 'Поиск в закладках...';
      default: return 'Поиск по личной ленте...';
    }
  };

  const getTitle = () => {
    switch (activeTab) {
      case 'telegram': return 'Фильтры Telegram';
      case 'youtube': return 'Фильтры YouTube';
      case 'bookmarks': return 'Фильтры закладок';
      default: return 'Фильтры ленты';
    }
  };

  const hasActiveFilters = filters.search || filters.dateFrom || filters.dateTo;

  const set = <K extends keyof typeof filters>(key: K, value: typeof filters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  const normalize = (s: string) => s.normalize('NFKD').toLowerCase();

  const filterChannels = (list: AvailableChannel[]) => {
    if (!searchQuery.trim()) return list;
    const q = normalize(searchQuery);
    return list.filter((c) => normalize(c.name).includes(q));
  };

  // Фильтруем каналы по активной вкладке и типу (public/private)
  const getVisibleChannels = () => {
    const filterByPrivacy = (list: AvailableChannel[]) => {
      if (activeTab === 'youtube' && channelTab === 'private') {
        // На вкладке YouTube показываем приватные только если они есть
        return list.filter(c => c.isPrivate === true);
      }
      // Показываем публичные
      return list.filter(c => c.isPrivate !== true);
    };

    if (activeTab === 'telegram') {
      return { telegram: filterChannels(filterByPrivacy(channels.filter((c) => c.sourceType === 'telegram'))), youtube: [] };
    }
    if (activeTab === 'youtube') {
      return { telegram: [], youtube: filterChannels(filterByPrivacy(channels.filter((c) => c.sourceType === 'youtube'))) };
    }
    // Для 'all' и 'bookmarks' показываем все доступные каналы
    return {
      telegram: filterChannels(filterByPrivacy(channels.filter((c) => c.sourceType === 'telegram'))),
      youtube: filterChannels(filterByPrivacy(channels.filter((c) => c.sourceType === 'youtube')))
    };
  };

  const { telegram: telegramChannels, youtube: youtubeChannels } = getVisibleChannels();

  // Показывать вкладки public/private только если есть приватные каналы
  const hasPrivateChannels = channels.some(c => c.sourceType === 'youtube' && c.isPrivate === true);

  return (
    <div className="subscription-manager" onClick={e => e.stopPropagation()}>
      {loading ? (
        <div className="subscription-manager__loading">Загрузка...</div>
      ) : (
        <>
          <div className="news-filters__group">
            <p className="news-filters__title">{getTitle()}</p>
          </div>

          <div className="news-filters__group">
            <NewsSearch 
              value={filters.search} 
              onChange={(v) => set('search', v)}
              placeholder={getSearchPlaceholder()}
            />
          </div>

          <div className="news-filters__group">
            <p className="news-filters__title">Период</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
              <label className="news-filters__date-label">
                С
                <input
                  type="date"
                  className="news-filters__date"
                  value={filters.dateFrom}
                  onChange={(e) => set('dateFrom', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </label>
              <label className="news-filters__date-label">
                По
                <input
                  type="date"
                  className="news-filters__date"
                  value={filters.dateTo}
                  onChange={(e) => set('dateTo', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </label>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="news-filters__group">
              <button type="button" className="news-filters__reset" onClick={onFiltersReset}>
                Очистить фильтры
              </button>
            </div>
          )}

          <div className="news-filters__group">
            <p className="news-filters__title">Поиск каналов</p>
            <NewsSearch value={searchQuery} onChange={setSearchQuery} placeholder="Поиск каналов..." />
          </div>

          {activeTab === 'youtube' && hasPrivateChannels && (
            <div className="news-filters__group">
              <div className="subscription-manager__tabs">
                <button
                  className={`subscription-manager__tab${channelTab === 'public' ? ' subscription-manager__tab--active' : ''}`}
                  onClick={() => setChannelTab('public')}
                >
                  Общедоступные
                </button>
                <button
                  className={`subscription-manager__tab${channelTab === 'private' ? ' subscription-manager__tab--active' : ''}`}
                  onClick={() => setChannelTab('private')}
                >
                  Приватные
                </button>
              </div>
            </div>
          )}

          {activeTab === 'bookmarks' ? (
            <div className="news-filters__group">
              <p className="news-filters__title">Сохранённые статьи</p>
              <p className="subscription-manager__empty">Закладки отключены</p>
            </div>
          ) : (
            <>
              {telegramChannels.length > 0 && (
                <div className="news-filters__group">
                  <div className="subscription-manager__header">
                    <p className="news-filters__title">Telegram ({telegramChannels.length})</p>
                    <button
                      className="subscription-manager__toggle-all"
                      onClick={() => {
                        const allEnabled = telegramChannels.every(c => selectedIds.has(c.id));
                        handleToggleAll('telegram', !allEnabled);
                      }}
                    >
                      {telegramChannels.every(c => selectedIds.has(c.id)) ? 'Отключить все' : 'Включить все'}
                    </button>
                  </div>
                  <ul className="telegram-channel-picker__list" role="listbox">
                    {telegramChannels.map((channel) => {
                      const isEnabled = selectedIds.has(channel.id);
                      return (
                        <li key={channel.id} className="telegram-channel-picker__item">
                          <button
                            className="telegram-channel-picker__name telegram-channel-picker__name--clickable"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (channel.username) {
                                navigate(`/my/telegram/${channel.username}`);
                                onClose();
                              }
                            }}
                          >
                            {channel.name}
                          </button>
                          <Switch
                            checked={isEnabled}
                            onChange={() => handleToggle(channel.id)}
                            aria-label={`Подписаться на ${channel.name}`}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {youtubeChannels.length > 0 && (
                <div className="news-filters__group">
                  <div className="subscription-manager__header">
                    <p className="news-filters__title">YouTube ({youtubeChannels.length})</p>
                    <button
                      className="subscription-manager__toggle-all"
                      onClick={() => {
                        const allEnabled = youtubeChannels.every(c => selectedIds.has(c.id));
                        handleToggleAll('youtube', !allEnabled);
                      }}
                    >
                      {youtubeChannels.every(c => selectedIds.has(c.id)) ? 'Отключить все' : 'Включить все'}
                    </button>
                  </div>
                  <ul className="telegram-channel-picker__list" role="listbox">
                    {youtubeChannels.map((channel) => {
                      const isEnabled = selectedIds.has(channel.id);
                      return (
                        <li key={channel.id} className="youtube-channel-picker__item">
                          <button
                            className="youtube-channel-picker__name youtube-channel-picker__name--clickable"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (channel.channelId) {
                                navigate(`/my/youtube/${channel.channelId}`);
                                onClose();
                              }
                            }}
                          >
                            {channel.name}
                          </button>
                          <Switch
                            checked={isEnabled}
                            onChange={() => handleToggle(channel.id)}
                            aria-label={`Подписаться на ${channel.name}`}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
