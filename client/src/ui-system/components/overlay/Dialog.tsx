/**
 * BlogPro Dialog Component
 * Universal modal dialog component
 */

import React, { useEffect } from 'react';
import { Icon } from '../../icons/components';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  children,
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

  const dialogClasses = [
    'dialog-content',
    `dialog-content--${size}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className="dialog-overlay p-4" onClick={onClose}>
      <div className={dialogClasses} onClick={(e) => e.stopPropagation()}>
        {showCloseButton && (
          <button className="dialog-close" onClick={onClose}>
            <Icon name="x" size={16} className="dialog-close-icon" />
          </button>
        )}
        
        {title && (
          <div className="dialog-header">
            <h3 className="dialog-title text-lg">{title}</h3>
          </div>
        )}
        
        <div className="dialog-description">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Dialog;
