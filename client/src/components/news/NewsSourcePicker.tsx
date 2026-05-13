import React, { useState, useEffect } from 'react';

interface Source { id: number; name: string; region: string; }

interface NewsSourcePickerProps {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

export const NewsSourcePicker: React.FC<NewsSourcePickerProps> = ({ selectedId, onSelect }) => {
  const [sources, setSources] = useState<Source[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/news/sources')
      .then(r => r.json())
      .then(d => { setSources(d.sources ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = query.trim()
    ? sources.filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
    : sources;

  const handleSelect = (id: number) => {
    onSelect(selectedId === id ? null : id);
    setQuery('');
  };

  const selectedName = sources.find(s => s.id === selectedId)?.name ?? null;

  return (
    <div className="news-source-picker">
      {selectedName && (
        <button className="news-city-picker__clear" onClick={() => onSelect(null)}>
          ✕ {selectedName}
        </button>
      )}
      <input
        className="news-city-picker__search"
        type="search"
        placeholder="Поиск источника..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <ul className="news-city-picker__list" role="listbox">
        {loading && <li className="news-city-picker__empty">Загрузка...</li>}
        {!loading && filtered.length === 0 && <li className="news-city-picker__empty">Источники не найдены</li>}
        {!loading && filtered.map(s => (
          <li
            key={s.id}
            role="option"
            aria-selected={selectedId === s.id}
            className={`news-city-picker__item${selectedId === s.id ? ' news-city-picker__item--active' : ''}`}
            onClick={() => handleSelect(s.id)}
          >
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
};
