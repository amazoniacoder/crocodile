/**
 * BlogPro Toast Component
 * Universal toast notifications
 */

import React, { useEffect } from 'react';
import { Icon } from '../../icons/components';

export interface ToastProps {
  children: React.ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  onClose?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  children,
  variant = 'info',
  duration = 5000,
  onClose,
  className = ''
}) => {
  useEffect(() => {
    if (duration > 0 && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const toastClasses = [
    'toast',
    `toast--${variant}`,
    'text-lg',
    'm-4',
    className
  ].filter(Boolean).join(' ');

  const getIcon = () => {
    switch (variant) {
      case 'success': return 'save';
      case 'warning': return 'gear';
      case 'error': return 'delete';
      default: return 'book';
    }
  };

  return (
    <div className={toastClasses}>
      <Icon name={getIcon()} size={16} className="toast__icon" />
      <div className="toast__content">{children}</div>
      {onClose && (
        <button
          className="toast__close"
          onClick={onClose}
          aria-label="Close toast"
        >
          <Icon name="delete" size={16} />
        </button>
      )}
    </div>
  );
};

export default Toast;
