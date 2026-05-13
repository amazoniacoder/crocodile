/**
 * BlogPro Pagination Component
 * Universal pagination with ellipsis and navigation
 */

import React from 'react';
import './pagination.css';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({ 
  currentPage, 
  totalPages, 
  onPageChange,
  className = ''
}) => {
  // Don't render pagination if there's only one page
  if (totalPages <= 1) return null;
  
  const renderPageNumbers = () => {
    const pages = [];
    
    // Always show first page
    pages.push(
      <button
        key={1}
        className={`pagination__button ${currentPage === 1 ? 'pagination__button--active' : ''}`}
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
      >
        1
      </button>
    );
    
    // Show ellipsis if needed
    if (currentPage > 3) {
      pages.push(<span key="ellipsis-1" className="pagination__ellipsis">...</span>);
    }
    
    // Show current page and neighbors
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      if (i === 1 || i === totalPages) continue; // Skip first and last page as they're always shown
      
      pages.push(
        <button
          key={i}
          className={`pagination__button ${currentPage === i ? 'pagination__button--active' : ''}`}
          onClick={() => onPageChange(i)}
        >
          {i}
        </button>
      );
    }
    
    // Show ellipsis if needed
    if (currentPage < totalPages - 2) {
      pages.push(<span key="ellipsis-2" className="pagination__ellipsis">...</span>);
    }
    
    // Always show last page if there's more than one page
    if (totalPages > 1) {
      pages.push(
        <button
          key={totalPages}
          className={`pagination__button ${currentPage === totalPages ? 'pagination__button--active' : ''}`}
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
        >
          {totalPages}
        </button>
      );
    }
    
    return pages;
  };
  
  return (
    <div className={`pagination ${className}`}>
      <button
        className="pagination__button pagination__button--nav"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        &lt;
      </button>
      
      {renderPageNumbers()}
      
      <button
        className="pagination__button pagination__button--nav"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        &gt;
      </button>
    </div>
  );
};

export default Pagination;
