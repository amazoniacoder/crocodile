import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useColorTheme } from '../theme/ColorThemeProvider';
import { themeColors } from '../../../utils/theme-colors';
import '../theme/color-picker.css';

export const ThemeColorPicker: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [measured, setMeasured] = useState(false);
  const { currentColor, setColorTheme } = useColorTheme();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isMobile = () => window.innerWidth < 768;

  const open = () => {
    if (!toggleRef.current) return;
    if (isMobile()) {
      const rect = toggleRef.current.getBoundingClientRect();
      setPos({ top: rect.top, left: rect.left + rect.width / 2 });
      setMeasured(false);
    }
    setIsOpen(true);
  };

  // После рендера дропдауна — измеряем его высоту и вычисляем финальную позицию
  useEffect(() => {
    if (!isOpen || !isMobile() || measured || !dropdownRef.current || !pos) return;
    const h = dropdownRef.current.offsetHeight;
    setPos(prev => prev ? { ...prev, top: prev.top - h - 8 } : prev);
    setMeasured(true);
  }, [isOpen, measured, pos]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (toggleRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleClose = useCallback(() => setIsOpen(false), []);

  const dropdown = (
    <div
      ref={dropdownRef}
      className="color-picker__dropdown p-4"
      style={pos && isMobile() ? {
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: 'translateX(-50%)',
        zIndex: 2000,
        visibility: measured ? 'visible' : 'hidden',
      } : undefined}
    >
      <div className="color-picker__grid">
        {themeColors.map((color) => (
          <button
            key={color.id}
            className={`color-picker__option${currentColor === color.id ? ' color-picker__option--active' : ''}`}
            onClick={() => { setColorTheme(color.id); handleClose(); }}
            title={color.name}
            style={{ background: color.primary }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="color-picker">
      <button
        ref={toggleRef}
        className="color-picker__toggle"
        onClick={open}
        aria-label="Select color theme"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="none">
          <circle cx="12" cy="7" r="5" fill="#ff0000" />
          <circle cx="7" cy="17" r="5" fill="#ffff00" />
          <circle cx="17" cy="17" r="5" fill="#00ff00" />
        </svg>
      </button>

      {isOpen && (
        isMobile()
          ? createPortal(dropdown, document.body)
          : dropdown
      )}
    </div>
  );
};

export default ThemeColorPicker;
