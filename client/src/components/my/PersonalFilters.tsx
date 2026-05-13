import React from 'react';
import { NewsSearch } from '../news/NewsSearch';
import { Switch } from '@/ui-system/components';
import { useDisplaySettings } from '@/contexts/display-settings-context';

export interface PersonalFiltersState {
  search: string;
  dateFrom: string;
  dateTo: string;
}

interface PersonalFiltersProps {
  activeTab: 'all' | 'telegram' | 'youtube' | 'bookmarks';
  filters: PersonalFiltersState;
  onChange: (filters: PersonalFiltersState) => void;
  onReset: () => void;
}

export const PersonalFilters: React.FC<PersonalFiltersProps> = ({
  activeTab,
  filters,
  onChange,
  onReset,
}) => {
  const { settings, toggleEmotions } = useDisplaySettings();
  
  const set = <K extends keyof PersonalFiltersState>(key: K, value: PersonalFiltersState[K]) =>
    onChange({ ...filters, [key]: value });

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

  return (
    <div onClick={(e) => e.stopPropagation()}>
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

      <div className="news-filters__group">
        <p className="news-filters__title">Отображение</p>
        <div className="news-filters__toggle-list">
          <div className="news-filters__toggle-row">
            <span className="news-filters__toggle-label">Эмоции на карточках</span>
            <Switch
              className="news-filters__switch"
              checked={settings.showEmotions}
              onChange={toggleEmotions}
              aria-label="Показывать эмоции на карточках"
            />
          </div>
        </div>
      </div>

      {hasActiveFilters && (
        <button type="button" className="news-filters__reset" onClick={onReset}>
          Очистить фильтры
        </button>
      )}
    </div>
  );
};