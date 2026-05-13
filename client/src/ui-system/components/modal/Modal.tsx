/**
 * BlogPro Modal Component
 * Minimalist modal system with TypeScript support
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../icons/components';

export interface ModalProps {
  isOpen: boolean;
  onClose: (e?: React.MouseEvent | KeyboardEvent) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  title?: string;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  children: React.ReactNode;
}

export interface ModalFooterProps {
  align?: 'left' | 'center' | 'right' | 'between';
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  size = 'md',
  title,
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className,
  children
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') {
        onClose(event);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, closeOnEscape, onClose]);

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (closeOnBackdropClick && event.target === backdropRef.current) {
      onClose(event);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={backdropRef}
      className="modal-backdrop"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className={`bp-modal modal--${size} ${className || ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {(title || showCloseButton) && (
          <div className="modal__header">
            {title && (
              <h2 id="modal-title" className="modal__title">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                className="modal__close border-none"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(e);
                }}
                aria-label="Close modal"
              >
                <Icon name="x" size={20} />
              </button>
            )}
          </div>
        )}
        
        <div className="modal__body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export const ModalBody: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className="modal__body">{children}</div>;
};

export const ModalFooter: React.FC<ModalFooterProps> = ({
  align = 'right',
  children
}) => {
  const alignClass = align === 'right' ? '' : `modal__footer--${align}`;
  
  return (
    <div className={`modal__footer ${alignClass}`.trim()}>
      {children}
    </div>
  );
};
