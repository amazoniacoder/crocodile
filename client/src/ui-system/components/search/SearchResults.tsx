/**
 * BlogPro Search Results Component
 * Universal search results display
 */

import React from 'react';
import { SearchResult } from './SearchDropdown';

export interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  loading?: boolean;
  onResultClick?: (result: SearchResult) => void;
  className?: string;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  query,
  loading = false,
  onResultClick,
  className = ''
}) => {
  return (
    <div className={`bp-search-results ${className}`}>
      <div className="search-results__header">
        <h2 className="search-results__title">
          Search Results for "{query}"
        </h2>
        <span className="search-results__count">
          {results.length} result{results.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="search-results__loading">
          Searching...
        </div>
      ) : results.length > 0 ? (
        <div className="search-results__list">
          {results.map((result) => (
            <article key={result.id} className="search-results__item">
              <h3 className="search-results__item-title">
                <button 
                  className="search-results__item-link"
                  onClick={() => onResultClick?.(result)}
                >
                  {result.title}
                </button>
              </h3>
              {result.description && (
                <p className="search-results__item-description">
                  {result.description}
                </p>
              )}
              {result.type && (
                <span className="search-results__item-type">
                  {result.type}
                </span>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="search-results__empty">
          <p>No results found for "{query}"</p>
          <p>Try adjusting your search terms or browse our content.</p>
        </div>
      )}
    </div>
  );
};

export default SearchResults;
