import React, { useState } from 'react';
import { NewsSearch } from './NewsSearch';
import { TelegramChannelPicker } from './TelegramChannelPicker';
import { YouTubeChannelPicker } from './YouTubeChannelPicker';
import { ContactPanel } from '@/components/contact';

export interface SocialFiltersState {
  search: string;
  selectedChannelId: number | null;
  enabledChannels: Record<number, boolean>;
}

export const SOCIAL_FILTERS_DEFAULT: SocialFiltersState = {
  search: '',
  selectedChannelId: null,
  enabledChannels: {},
};

interface SocialFiltersProps {
  filters: SocialFiltersState;
  onChange: (filters: SocialFiltersState) => void;
  onPickerReady?: () => void;
  sourceType?: 'telegram' | 'youtube';
}

export const SocialFilters: React.FC<SocialFiltersProps> = ({ filters, onChange, onPickerReady, sourceType = 'telegram' }) => {
  const [contactOpen, setContactOpen] = useState(false);
  const [contactSubject, setContactSubject] = useState<string>('feature');
  const [contactMessage, setContactMessage] = useState<string>('');

  const openContact = (subject: string, message: string) => {
    setContactSubject(subject);
    setContactMessage(message);
    setContactOpen(true);
  };

  const set = <K extends keyof SocialFiltersState>(key: K, value: SocialFiltersState[K]) =>
    onChange({ ...filters, [key]: value });

  const pickerProps = {
    selectedId: filters.selectedChannelId,
    enabledChannels: filters.enabledChannels,
    onSelect: (id: number | null) => set('selectedChannelId', id),
    onToggle: (id: number, enabled: boolean) =>
      set('enabledChannels', { ...filters.enabledChannels, [id]: enabled }),
    onInitChannels: (ids: number[]) => {
      onPickerReady?.();
      if (Object.keys(filters.enabledChannels).length === 0) {
        const init: Record<number, boolean> = {};
        ids.forEach(id => { init[id] = true; });
        set('enabledChannels', init);
      }
    },
  };

  const channelLabel = sourceType === 'youtube' ? 'YouTube' : 'Telegram';

  return (
    <div onClick={e => e.stopPropagation()}>
      <div className="news-filters__group">
        <NewsSearch value={filters.search} onChange={v => set('search', v)} />
      </div>

      <div className="news-filters__group">
        <div className="news-filters__channels-header">
          <div className="news-filters__channels-actions">
            <button
              type="button"
              className="news-filters__contact-btn news-filters__contact-btn--warn"
              onClick={() => openContact('bug', '')}
              title="Сообщить о проблеме"
            >
              Сообщить о проблеме
            </button>
          </div>
        </div>
        {sourceType === 'youtube'
          ? <YouTubeChannelPicker {...pickerProps} />
          : <TelegramChannelPicker {...pickerProps} />
        }
      </div>

      <button
        type="button"
        className="news-filters__reset"
        onClick={() => onChange(SOCIAL_FILTERS_DEFAULT)}
      >
        Сбросить фильтры
      </button>

      <ContactPanel
        isOpen={contactOpen}
        onClose={() => setContactOpen(false)}
        initialSubject={contactSubject}
        initialMessage={contactMessage}
      />
    </div>
  );
};
