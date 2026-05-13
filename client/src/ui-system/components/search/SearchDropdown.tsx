/**
 * BlogPro Search Dropdown Component
 * Complete search interface with input and results
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { SearchInput } from './SearchInput';
import { SearchResults } from './SearchResults';

export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  url: string;
  type?: string;
}

export interface SearchDropdownProps {
  onClose?: () => void;
  className?: string;
}

export const SearchDropdown: React.FC<SearchDropdownProps> = ({
  onClose,
  className = ''
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (query.length > 1) {
      setIsLoading(true);
      
      const searchTimeout = setTimeout(async () => {
        try {
          // Use unified search endpoint with auto language detection
          const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`);
          
          if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
          }
          
          const data = await response.json();
          
          // Transform unified results to SearchResult format
          const transformedResults = data.results?.map((item: any) => ({
            id: `${item.type}-${item.id}`,
            title: item.title,
            description: item.description,
            url: item.url,
            type: item.type === 'blog' ? 'Blog Post' : 
                  item.type === 'product' ? 'Product' : 
                  item.type === 'documentation' ? 'Documentation' : 'Page'
          })) || [];
          
          // Add static pages if query matches
          const staticPages = [
            { id: 'about', title: 'About Us', url: '/about', type: 'Page' },
            { id: 'contact', title: 'Contact', url: '/contact', type: 'Page' },
            { id: 'services', title: 'Services', url: '/services', type: 'Page' }
          ].filter(page => 
            page.title.toLowerCase().includes(query.toLowerCase())
          );
          
          setResults([...transformedResults, ...staticPages]);
        } catch (error) {
          console.error('Search error:', error);
          setResults([]);
        } finally {
          setIsLoading(false);
        }
      }, 150);

      return () => clearTimeout(searchTimeout);
    } else {
      setResults([]);
      setIsLoading(false);
    }
  }, [query]);

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
  };

  const handleResultClick = (result: any) => {
    // Convert blog post result to URL
    const url = result.slug ? `/blog/${result.slug}` : result.url || '#';
    setLocation(url);
    onClose?.();
  };

  return (
    <div className={`search-dropdown ${className}`}>
      <SearchInput
        value={query}
        onChange={handleQueryChange}
        placeholder="Search..."
        autoFocus
      />
      
      {query.length > 1 && (
        <>
          {results.length > 0 && (
            <div className="search-dropdown__title text-sm">
              {results.length} result{results.length !== 1 ? 's' : ''} found
            </div>
          )}
          <SearchResults
            results={results}
            query={query}
            loading={isLoading}
            onResultClick={handleResultClick}
          />
          {!isLoading && results.length === 0 && (
            <div className="search-dropdown__empty text-sm">
              No results found for "{query}"
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SearchDropdown;
