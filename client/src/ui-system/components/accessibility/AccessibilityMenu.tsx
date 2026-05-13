/**
 * BlogPro Accessibility Menu Component
 * Font size controls and accessibility features
 */

import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '../../icons/components';

export interface AccessibilityMenuProps {
  className?: string;
}

export const AccessibilityMenu: React.FC<AccessibilityMenuProps> = ({
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
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

  const handleFontSizeChange = (delta: number) => {
    const newSize = Math.max(80, Math.min(120, fontSize + delta));
    setFontSize(newSize);
    document.documentElement.style.fontSize = `${newSize}%`;
  };

  const resetFontSize = () => {
    setFontSize(100);
    document.documentElement.style.fontSize = '100%';
  };

  return (
    <div className={`accessibility-menu ${className}`.trim()} ref={menuRef}>
      <button
        className="accessibility-menu__toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Accessibility menu"
        aria-expanded={isOpen}
      >
        <Icon name="add" size={20} />
      </button>

      {isOpen && (
        <div className="accessibility-menu__dropdown">
          <div className="accessibility-menu__header">
            <h3 className="accessibility-menu__title">Font Size</h3>
            <span className="accessibility-menu__value">{fontSize}%</span>
          </div>

          <div className="accessibility-menu__buttons">
            <button
              className={`accessibility-menu__button ${fontSize <= 80 ? 'accessibility-menu__button--disabled' : ''}`}
              onClick={() => handleFontSizeChange(-10)}
              disabled={fontSize <= 80}
              aria-label="Decrease font size"
            >
              <Icon name="minus" size={16} />
            </button>

            <button
              className="accessibility-menu__button"
              onClick={resetFontSize}
              aria-label="Reset font size"
            >
              <Icon name="refresh" size={16} />
            </button>

            <button
              className={`accessibility-menu__button ${fontSize >= 120 ? 'accessibility-menu__button--disabled' : ''}`}
              onClick={() => handleFontSizeChange(10)}
              disabled={fontSize >= 120}
              aria-label="Increase font size"
            >
              <Icon name="add" size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessibilityMenu;
