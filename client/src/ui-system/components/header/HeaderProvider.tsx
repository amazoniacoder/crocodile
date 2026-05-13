/**
 * BlogPro Header Provider
 * Manages all header state and logic
 */

import React, { useState, useCallback, ReactNode } from 'react';
import { HeaderContext, NavigationItem, HeaderContextType } from './HeaderContext';

interface HeaderProviderProps {
  children: ReactNode;
}

export const HeaderProvider: React.FC<HeaderProviderProps> = ({ children }) => {
  const [slideMenuOpen, setSlideMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [availableSpace, setAvailableSpace] = useState(0);
  const [visibleItems, setVisibleItems] = useState<NavigationItem[]>([]);
  const [overflowItems, setOverflowItems] = useState<NavigationItem[]>([]);

  const toggleSlideMenu = useCallback(() => {
    setSlideMenuOpen(prev => !prev);
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev);
  }, []);

  const updateItemVisibility = useCallback((visible: NavigationItem[], overflow: NavigationItem[]) => {
    setVisibleItems(visible);
    setOverflowItems(overflow);
  }, []);

  const contextValue: HeaderContextType = {
    slideMenuOpen,
    mobileMenuOpen,
    availableSpace,
    visibleItems,
    overflowItems,
    toggleSlideMenu,
    toggleMobileMenu,
    setAvailableSpace,
    updateItemVisibility,
  };

  return (
    <HeaderContext.Provider value={contextValue}>
      {children}
    </HeaderContext.Provider>
  );
};
