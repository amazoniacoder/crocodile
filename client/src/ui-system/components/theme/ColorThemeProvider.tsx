/**
 * BlogPro Color Theme Provider
 * Context provider for color theme management
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { applyColorTheme, getStoredColorTheme, setStoredColorTheme } from '../../../utils/theme-colors';

export interface ColorThemeContextType {
  currentColor: string;
  setColorTheme: (colorId: string) => void;
}

const ColorThemeContext = createContext<ColorThemeContextType | undefined>(undefined);

export interface ColorThemeProviderProps {
  children: ReactNode;
}

export const ColorThemeProvider: React.FC<ColorThemeProviderProps> = ({ children }) => {
  const [currentColor, setCurrentColor] = useState<string>('blue');

  useEffect(() => {
    const savedColor = getStoredColorTheme();
    setCurrentColor(savedColor);
    applyColorTheme(savedColor);
  }, []);

  const setColorTheme = (colorId: string) => {
    setCurrentColor(colorId);
    setStoredColorTheme(colorId);
    applyColorTheme(colorId);
  };

  return (
    <ColorThemeContext.Provider value={{ currentColor, setColorTheme }}>
      {children}
    </ColorThemeContext.Provider>
  );
};

export const useColorTheme = (): ColorThemeContextType => {
  const context = useContext(ColorThemeContext);
  if (!context) {
    throw new Error('useColorTheme must be used within ColorThemeProvider');
  }
  return context;
};

export default ColorThemeProvider;
