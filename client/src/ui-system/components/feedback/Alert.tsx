/**
 * BlogPro Alert Component
 * Universal alert notifications
 */

import React from 'react';
import { Icon } from '../../icons/components';

export interface AlertProps {
  title?: string;
  message?: string;
  children?: React.ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'error';
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  title,
  message,
  children,
  variant = 'info',
  dismissible = false,
  onDismiss,
  className = ''
}) => {
  const alertClasses = [
    'alert',
    `alert--${variant}`,
    'text-sm',
    className
  ].filter(Boolean).join(' ');

  const getIcon = () => {
    switch (variant) {
      case 'success': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'info';
    }
  };

  return (
    <div className={alertClasses} role="alert">
      <Icon name={getIcon()} size={16} className="alert__icon" />
      <div className="alert__content">
        {title && <div className="alert__title">{title}</div>}
        {message && <div className="alert__message">{message}</div>}
        {children}
      </div>
      {dismissible && (
        <button
          className="alert__close opacity-100"
          onClick={onDismiss}
          aria-label="Dismiss alert"
        >
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
};

export default Alert;
