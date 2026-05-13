import React from 'react';
import { NewsSearch } from './NewsSearch';
import { NewsCityPicker } from './NewsCityPicker';
import { NewsSourcePicker } from './NewsSourcePicker';
import { Switch } from '@/ui-system/components';
import { useDisplaySettings } from '@/contexts/display-settings-context';
import { NEWS_CATEGORIES } from '../../../../shared/types/news';
import type { NewsRegion, NewsCategory } from '../../../../shared/types/news';

export interface NewsFiltersState {
  region: NewsRegion | 'all';
  category: NewsCategory[] | 'all';
  city: string | null;
  date: string;
  search: string;
  sourceId: number | null;
}

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  economy: 'Экономика',
  tech: 'Технологии',
  politics: 'Политика',
  society: 'Общество',
  other: 'Другое',
};

interface NewsFiltersProps {
  filters: NewsFiltersState;
  onChange: (filters: NewsFiltersState) => void;
  archiveWindowLabel?: string | null;
  onArchiveWindowShift?: (direction: 'older' | 'newer') => void;
  enabledRegions?: {
    russia: boolean;
    world: boolean;
    cities: boolean;
  };
  onEnabledRegionsChange?: (enabledRegions: { russia: boolean; world: boolean; cities: boolean }) => void;
}

export const NewsFilters: React.FC<NewsFiltersProps> = ({
  filters,
  onChange,
  archiveWindowLabel,
  onArchiveWindowShift,
  enabledRegions = { russia: true, world: true, cities: true },
  onEnabledRegionsChange,
}) => {
  const { settings, toggleEmotions } = useDisplaySettings();
  
  const set = <K extends keyof NewsFiltersState>(key: K, value: NewsFiltersState[K]) =>
    onChange({ ...filters, [key]: value });

  const setCity = (city: string | null) =>
    onChange({ ...filters, city, sourceId: null });

  const setSourceId = (id: number | null) =>
    onChange({ ...filters, sourceId: id, city: null });

  const toggleCategory = (cat: NewsCategory) => {
    const current = filters.category === 'all' ? [] : [...filters.category];
    const next = current.includes(cat)
      ? current.filter(c => c !== cat)
      : [...current, cat];
    onChange({ ...filters, category: next.length === 0 ? 'all' : next });
  };

  const isCategoryActive = (cat: NewsCategory): boolean =>
    filters.category !== 'all' && filters.category.includes(cat);

  const reset = () => {
    onChange({ ...filters, category: 'all', city: null, date: '', search: '', sourceId: null });
  };

  const handleRegionToggle = (key: 'russia' | 'world' | 'cities') => {
    onEnabledRegionsChange?.({
      ...enabledRegions,
      [key]: !enabledRegions[key],
    });
  };

  const showCityPicker = filters.region !== 'world';

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="news-filters__group">
        <NewsSearch value={filters.search} onChange={(v) => set('search', v)} />
      </div>

      <div className="news-filters__group">
        <p className="news-filters__title">Дата</p>
        <input
          type="date"
          className="news-filters__date"
          value={filters.date}
          onChange={(e) => set('date', e.target.value)}
          max={new Date().toISOString().split('T')[0]}
        />
        {!!filters.date && !!onArchiveWindowShift && (
          <>
            <div className="news-filters__date-nav">
              <button
                type="button"
                className="news-filters__date-btn"
                onClick={() => onArchiveWindowShift('older')}
              >
                Неделей раньше
              </button>
              <button
                type="button"
                className="news-filters__date-btn"
                onClick={() => onArchiveWindowShift('newer')}
              >
                Неделей позже
              </button>
            </div>
            {archiveWindowLabel && (
              <p className="news-filters__date-range">
                Окно архива: {archiveWindowLabel}
              </p>
            )}
          </>
        )}
      </div>

      {showCityPicker && (
        <div className="news-filters__group">
          <p className="news-filters__title">Город</p>
          <NewsCityPicker
            selectedCity={filters.city}
            onSelect={setCity}
          />
        </div>
      )}

      <div className="news-filters__group">
        <p className="news-filters__title">Категории</p>
        <div className="news-filters__categories">
          {NEWS_CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              className={`news-filters__cat-btn${isCategoryActive(cat) ? ' news-filters__cat-btn--active' : ''}`}
              onClick={() => toggleCategory(cat)}
              aria-pressed={isCategoryActive(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="news-filters__group">
        <p className="news-filters__title">Показывать в ленте</p>
        <div className="news-filters__toggle-list">
          <div className="news-filters__toggle-row">
            <span className="news-filters__toggle-label">Россия</span>
            <Switch
              className="news-filters__switch"
              checked={enabledRegions.russia}
              onChange={() => handleRegionToggle('russia')}
              aria-label="Показывать новости России"
            />
          </div>
          <div className="news-filters__toggle-row">
            <span className="news-filters__toggle-label">Мир</span>
            <Switch
              className="news-filters__switch"
              checked={enabledRegions.world}
              onChange={() => handleRegionToggle('world')}
              aria-label="Показывать новости мира"
            />
          </div>
          <div className="news-filters__toggle-row">
            <span className="news-filters__toggle-label">Города</span>
            <Switch
              className="news-filters__switch"
              checked={enabledRegions.cities}
              onChange={() => handleRegionToggle('cities')}
              aria-label="Показывать новости городских источников"
            />
          </div>
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
              aria-label="Показывать эмоции на карточках новостей"
            />
          </div>
        </div>
      </div>

      <div className="news-filters__group">
        <p className="news-filters__title">Источники</p>
        <NewsSourcePicker
          selectedId={filters.sourceId}
          onSelect={setSourceId}
        />
      </div>

      <button type="button" className="news-filters__reset" onClick={reset}>
        Сбросить фильтры
      </button>
    </div>
  );
};
