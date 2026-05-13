import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from '@/ui-system/icons/components';

interface Location {
  id: number;
  name: string;
  country: string;
}

interface Props {
  locations: Location[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  
  if (index === -1) return text;
  
  return (
    <>
      {text.slice(0, index)}
      <mark className="city-search__highlight">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

const CitySearchInput: React.FC<Props> = ({ locations, selectedId, onSelect }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedCity = locations.find(l => l.id === selectedId);

  // Фильтрация и сортировка с debounce
  const filteredLocations = useMemo(() => {
    if (!query.trim()) return locations;
    
    const lowerQuery = query.toLowerCase();
    const matches = locations.filter(loc => 
      loc.name.toLowerCase().includes(lowerQuery)
    );

    // Сортировка: совпадения с начала → остальные → алфавит
    return matches.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
      const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
      
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      
      return a.name.localeCompare(b.name, 'ru');
    });
  }, [query, locations]);

  // Закрытие при клике вне
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Навигация клавиатурой
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev < filteredLocations.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && filteredLocations[focusedIndex]) {
          handleSelect(filteredLocations[focusedIndex].id);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (id: number) => {
    onSelect(id);
    setIsOpen(false);
    setQuery('');
    setFocusedIndex(-1);
    inputRef.current?.blur();
  };

  // Скролл к выбранному элементу
  useEffect(() => {
    if (focusedIndex >= 0 && dropdownRef.current) {
      const item = dropdownRef.current.children[focusedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedIndex]);

  return (
    <div className="city-search">
      <div className="city-search__input-wrap">
        <Icon name="search" size={16} className="city-search__icon" />
        <input
          ref={inputRef}
          type="text"
          className="city-search__input"
          placeholder={selectedCity?.name || 'Поиск города...'}
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
            setFocusedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {query && (
          <button
            className="city-search__clear"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Очистить"
          >
            <Icon name="x" size={14} />
          </button>
        )}
      </div>

      {isOpen && (
        <div ref={dropdownRef} className="city-search__dropdown">
          {filteredLocations.length === 0 ? (
            <div className="city-search__empty">
              <Icon name="search" size={20} />
              <span>Город не найден</span>
            </div>
          ) : (
            filteredLocations.map((loc, index) => (
              <button
                key={loc.id}
                className={`city-search__item${
                  loc.id === selectedId ? ' city-search__item--selected' : ''
                }${
                  index === focusedIndex ? ' city-search__item--focused' : ''
                }`}
                onClick={() => handleSelect(loc.id)}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                <Icon name="location" size={14} />
                <span className="city-search__item-name">
                  {highlightMatch(loc.name, query)}
                </span>
                {loc.id === selectedId && (
                  <Icon name="check" size={14} className="city-search__check" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CitySearchInput;
