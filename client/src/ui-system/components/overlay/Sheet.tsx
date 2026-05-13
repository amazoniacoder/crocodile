/**
 * BlogPro Sheet Component
 * Universal side sheet component
 */

import React, { useEffect } from 'react';
import { Icon } from '../../icons/components';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
  showCloseButton?: boolean;
  className?: string;
}

export const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  title,
  children,
  side = 'right',
  size = 'md',
  showCloseButton = true,
  className = ''
}) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  const sheetClasses = [
    'sheet-content',
    `sheet-${side}`,
    `sheet-content--${size}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className={sheetClasses} data-state="open" onClick={(e) => e.stopPropagation()}>
        {(title || showCloseButton) && (
          <div className="sheet-header">
            {title && (
              <h3 className="sheet-title">{title}</h3>
            )}
            {showCloseButton && (
              <button className="sheet-close" onClick={onClose}>
                <Icon name="x" size={16} className="sheet-close-icon" />
              </button>
            )}
          </div>
        )}
        
        <div className="sheet-description">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Sheet;
