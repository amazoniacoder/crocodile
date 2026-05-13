/**
 * Unified Notification Component
 * Centralized notification system with consistent styling and theme support
 */

import React, { useEffect, useState } from 'react';
import { Icon } from '../../icons/components';

export interface NotificationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  onClose?: () => void;
  autoClose?: boolean;
  modal?: boolean; // For important actions
}

export const UnifiedNotification: React.FC<NotificationProps> = ({
  type,
  title,
  message,
  duration = 4000,
  onClose,
  autoClose = true,
  modal = false
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoClose && duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, autoClose, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose?.(), 300);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && modal) {
      handleClose();
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success': return 'check';
      case 'error': return 'x';
      case 'warning': return 'alert-circle';
      case 'info': return 'info';
      default: return 'info';
    }
  };

  const notificationClasses = [
    'notification',
    `notification--${type}`,
    modal ? 'notification--modal' : 'notification--toast',
    isVisible ? 'notification--visible' : 'notification--hidden'
  ].join(' ');

  const content = (
    <div className={notificationClasses}>
      <div className="notification__content">
        <div className="notification__icon">
          <Icon name={getIcon()} size={20} />
        </div>
        <div className="notification__text">
          {title && <div className="notification__title">{title}</div>}
          <div className="notification__message">{message}</div>
        </div>
        <button 
          className="notification__close"
          onClick={handleClose}
          aria-label="Close notification"
        >
          <Icon name="x" size={16} />
        </button>
      </div>
    </div>
  );

  if (modal) {
    return (
      <>
        <div 
          className={`notification-overlay ${isVisible ? 'notification-overlay--visible' : ''}`}
          onClick={handleOverlayClick}
        />
        {content}
      </>
    );
  }

  return content;
};

export default UnifiedNotification;