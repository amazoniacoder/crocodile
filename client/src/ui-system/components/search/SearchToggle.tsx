/**
 * BlogPro Search Toggle Component
 * Search toggle with dropdown functionality
 */

import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '../../icons/components';
import { SearchDropdown } from './SearchDropdown';

export interface SearchToggleProps {
  className?: string;
}

export const SearchToggle: React.FC<SearchToggleProps> = ({
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={`search-toggle-container ${className}`} ref={searchRef}>
      <button
        className={`header__icon-link search-toggle ${isOpen ? 'search-toggle--active' : ''}`}
        onClick={handleToggle}
        aria-label={isOpen ? 'Close search' : 'Open search'}
        aria-expanded={isOpen}
      >
        <Icon name={isOpen ? 'x' : 'search'} size={20} />
      </button>
      
      {isOpen && (
        <div className="search-dropdown-wrapper">
          <SearchDropdown onClose={() => setIsOpen(false)} />
        </div>
      )}
    </div>
  );
};

export default SearchToggle;
