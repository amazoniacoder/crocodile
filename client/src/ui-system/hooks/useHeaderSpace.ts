/**
 * BlogPro Header Space Calculator Hook
 * Calculates available space and manages item visibility
 */

import { useEffect, useCallback } from 'react';
import { useHeader, NavigationItem } from '../components/header/HeaderContext';

interface UseHeaderSpaceProps {
  navigationItems: NavigationItem[];
  containerRef: React.RefObject<HTMLElement>;
  logoWidth?: number;
  actionsWidth?: number;
}

export const useHeaderSpace = ({
  navigationItems,
  containerRef,
  logoWidth = 200,
  actionsWidth = 200
}: UseHeaderSpaceProps) => {
  const { 
    slideMenuOpen, 
    setAvailableSpace, 
    updateItemVisibility 
  } = useHeader();

  const measureItemWidths = useCallback(() => {
    if (!containerRef.current) return navigationItems;
    
    // Create temporary elements to measure actual widths
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.visibility = 'hidden';
    tempContainer.style.whiteSpace = 'nowrap';
    tempContainer.className = 'header__nav-list';
    document.body.appendChild(tempContainer);

    const measuredItems = navigationItems.map(item => {
      const tempItem = document.createElement('div');
      tempItem.className = 'header__nav-item';
      tempItem.innerHTML = `<a class="header__nav-link">${item.label}</a>`;
      tempContainer.appendChild(tempItem);
      
      const width = tempItem.offsetWidth + 16; // Add padding
      tempContainer.removeChild(tempItem);
      
      return { ...item, width };
    });

    document.body.removeChild(tempContainer);
    return measuredItems;
  }, [navigationItems]);

  const calculateVisibility = useCallback(() => {
    if (!containerRef.current || typeof window === 'undefined' || navigationItems.length === 0) {
      // Fallback: show all items if calculation fails
      updateItemVisibility(navigationItems, []);
      return;
    }

    const containerWidth = containerRef.current.clientWidth;
    const slideMenuWidth = slideMenuOpen ? 320 : 0; // Slide menu takes space when open
    const overflowButtonWidth = slideMenuOpen ? 50 : 0; // Only reserve space when slide menu is open
    const availableNavSpace = containerWidth - logoWidth - actionsWidth - slideMenuWidth - overflowButtonWidth - 40;

    setAvailableSpace(availableNavSpace);

    // If slide menu is closed, show all items
    if (!slideMenuOpen) {
      updateItemVisibility(navigationItems, []);
      return;
    }

    // When slide menu is open, calculate which items to hide
    const measuredItems = measureItemWidths();
    const sortedItems = [...measuredItems].sort((a, b) => (b.priority || 1) - (a.priority || 1)); // Reverse sort - higher priority items hide first
    
    let usedSpace = 0;
    const visible: NavigationItem[] = [];
    const overflow: NavigationItem[] = [];

    // First pass: add items from lowest priority (highest number)
    const reversedItems = [...sortedItems].reverse();
    
    reversedItems.forEach(item => {
      const itemWidth = item.width || 120;
      
      if (usedSpace + itemWidth <= availableNavSpace) {
        visible.unshift(item); // Add to beginning to maintain order
        usedSpace += itemWidth;
      } else {
        overflow.unshift(item); // Add to beginning to maintain order
      }
    });

    updateItemVisibility(visible, overflow);
  }, [
    navigationItems,
    containerRef,
    slideMenuOpen,
    logoWidth,
    actionsWidth,
    setAvailableSpace,
    updateItemVisibility,
    measureItemWidths
  ]);

  // Initial visibility setup
  useEffect(() => {
    if (navigationItems.length > 0) {
      calculateVisibility();
    }
  }, [calculateVisibility, navigationItems.length]);

  // Ensure items are visible on first load
  useEffect(() => {
    if (navigationItems.length > 0) {
      updateItemVisibility(navigationItems, []);
    }
  }, [navigationItems, updateItemVisibility]);

  useEffect(() => {
    const handleResize = () => calculateVisibility();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateVisibility]);

  return { calculateVisibility };
};
