import React, { useState, useEffect, useRef } from 'react';

interface NewsCityPickerProps {
  selectedCity: string | null;
  onSelect: (city: string | null) => void;
}

export const NewsCityPicker: React.FC<NewsCityPickerProps> = ({ selectedCity, onSelect }) => {
  const [cities, setCities] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/news/cities')
      .then(r => r.json())
      .then(d => setCities(d.cities ?? []))
      .catch(() => {});
  }, []);

  const filtered = query.trim()
    ? [
        ...cities.filter(c => c.toLowerCase().startsWith(query.toLowerCase())),
        ...cities.filter(c =>
          !c.toLowerCase().startsWith(query.toLowerCase()) &&
          c.toLowerCase().includes(query.toLowerCase())
        ),
      ]
    : cities;

  const handleSelect = (city: string) => {
    onSelect(selectedCity === city ? null : city);
    setQuery('');
  };

  return (
    <div className="news-city-picker">
      <input
        ref={inputRef}
        className="news-city-picker__search"
        type="search"
        placeholder="Поиск города..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        aria-label="Поиск города"
      />

      {selectedCity && (
        <button
          className="news-city-picker__clear"
          onClick={() => { onSelect(null); setQuery(''); }}
        >
          ✕ {selectedCity}
        </button>
      )}

      <ul className="news-city-picker__list" role="listbox">
        {filtered.length === 0 && (
          <li className="news-city-picker__empty">Города не найдены</li>
        )}
        {filtered.map(city => (
          <li
            key={city}
            role="option"
            aria-selected={selectedCity === city}
            className={`news-city-picker__item${selectedCity === city ? ' news-city-picker__item--active' : ''}`}
            onClick={() => handleSelect(city)}
          >
            {city}
          </li>
        ))}
      </ul>
    </div>
  );
};
