/**
 * BlogPro Header Context
 * Centralized state management for header components
 */

import { createContext, useContext } from 'react';

export interface NavSubItem {
  label: string;
  category?: string;  // Для категорий новостей
  href?: string;      // Для обычных ссылок
}

export interface NavigationItem {
  id: string;
  label: string;
  href?: string;
  priority?: number;
  width?: number;
  subItems?: NavSubItem[];
}

export interface HeaderContextType {
  // State
  slideMenuOpen: boolean;
  mobileMenuOpen: boolean;
  availableSpace: number;
  visibleItems: NavigationItem[];
  overflowItems: NavigationItem[];
  
  // Actions
  toggleSlideMenu: () => void;
  toggleMobileMenu: () => void;
  setAvailableSpace: (space: number) => void;
  updateItemVisibility: (visible: NavigationItem[], overflow: NavigationItem[]) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export const useHeader = () => {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error('useHeader must be used within a HeaderProvider');
  }
  return context;
};

export { HeaderContext };
