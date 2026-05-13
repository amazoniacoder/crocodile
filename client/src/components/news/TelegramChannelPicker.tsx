import React, { useState, useEffect } from 'react';
import { Switch } from '@/ui-system/components';
import { SubscriptionGate } from './SubscriptionGate';

interface Source {
  id: number;
  name: string;
  region: string;
  isFeatured: boolean;
}

interface TelegramChannelPickerProps {
  selectedId: number | null;
  enabledChannels: Record<number, boolean>;
  onSelect: (id: number | null) => void;
  onToggle: (id: number, enabled: boolean) => void;
  onInitChannels: (ids: number[]) => void;
}

export const TelegramChannelPicker: React.FC<TelegramChannelPickerProps> = ({
  selectedId,
  enabledChannels,
  onSelect,
  onToggle,
  onInitChannels,
}) => {
  const [channels, setChannels] = useState<Source[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/telegram/channels')
      .then(r => r.json())
      .then(d => {
        const list: Source[] = d.channels ?? [];
        setChannels(list);
        setLoading(false);
        // Инициализируем enabledChannels только по featured-каналам
        onInitChannels(list.filter(c => c.isFeatured).map(c => c.id));
      })
      .catch(() => setLoading(false));
  }, []);

  const normalize = (s: string) => s.normalize('NFKD').toLowerCase();

  const featured = channels.filter(c => c.isFeatured);
  const locked = channels.filter(c => !c.isFeatured);

  const filteredFeatured = query.trim()
    ? featured.filter(c => normalize(c.name).includes(normalize(query)))
    : featured;

  const handleSelect = (id: number) => {
    onSelect(selectedId === id ? null : id);
    setQuery('');
  };

  const selectedName = featured.find(c => c.id === selectedId)?.name ?? null;

  return (
    <div className="telegram-channel-picker">
      {selectedName && (
        <button className="news-city-picker__clear" onClick={() => onSelect(null)}>
          ✕ {selectedName}
        </button>
      )}
      <input
        className="news-city-picker__search"
        type="search"
        placeholder="Поиск канала..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        aria-label="Поиск Telegram-канала"
      />
      <ul className="telegram-channel-picker__list" role="listbox">
        {loading && <li className="news-city-picker__empty">Загрузка...</li>}
        {!loading && filteredFeatured.length === 0 && !query && <li className="news-city-picker__empty">Каналы не найдены</li>}
        {!loading && filteredFeatured.map(c => {
          const isEnabled = enabledChannels[c.id] !== false;
          return (
            <li
              key={c.id}
              className={`telegram-channel-picker__item${selectedId === c.id ? ' telegram-channel-picker__item--selected' : ''}`}
            >
              <span className="telegram-channel-picker__name" onClick={() => handleSelect(c.id)}>
                {c.name}
              </span>
              <Switch
                checked={isEnabled}
                onChange={() => onToggle(c.id, !isEnabled)}
                aria-label={`Показывать посты ${c.name}`}
              />
            </li>
          );
        })}
        {!loading && !query && <SubscriptionGate />}
      </ul>
    </div>
  );
};
