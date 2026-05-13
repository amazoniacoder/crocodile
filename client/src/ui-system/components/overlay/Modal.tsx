/**
 * BlogPro Modal Component
 * Universal modal with overlay and portal
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../icons/components';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnOverlayClick?: boolean;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  closeOnOverlayClick = true,
  className = ''
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const modalClasses = [
    'modal',
    className
  ].filter(Boolean).join(' ');

  return createPortal(
    <div className={modalClasses} onClick={handleOverlayClick}>
      <div className="modal__overlay"></div>
      <div className="modal__container" ref={modalRef}>
        {title && (
          <div className="modal__header">
            <h2 className="modal__title">{title}</h2>
            <button 
              className="modal__close" 
              onClick={onClose}
              aria-label="Close modal"
            >
              <Icon name="x" size={18} />
            </button>
          </div>
        )}
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
