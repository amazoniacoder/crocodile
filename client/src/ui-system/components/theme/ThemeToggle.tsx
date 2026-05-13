/**
 * BlogPro Theme Toggle Component
 * Universal theme toggle button
 */

import React from 'react';
import { useTheme } from './ThemeProvider';
import { Icon } from '../../icons/components';
import './theme.css';

export interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = ''
}) => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  
  return (
    <button 
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {resolvedTheme === 'dark' ? (
        <Icon name="sun" size={20} className="theme-toggle__icon theme-toggle__icon--sun" />
      ) : (
        <Icon name="moon" size={20} className="theme-toggle__icon theme-toggle__icon--moon" />
      )}
    </button>
  );
};

export default ThemeToggle;
