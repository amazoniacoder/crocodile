import React, { useEffect } from 'react';
import { Icon } from '@/ui-system/icons/components';
import { ContactForm } from './ContactForm';

interface ContactPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialSubject?: string;
  initialMessage?: string;
}

export const ContactPanel: React.FC<ContactPanelProps> = ({ isOpen, onClose, initialSubject, initialMessage }) => {
  // ESC для закрытия
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`contact-panel__backdrop ${isOpen ? 'contact-panel__backdrop--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div 
        className={`contact-panel ${isOpen ? 'contact-panel--open' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="contact-panel__header">
          <h2 className="contact-panel__title">
            <Icon name="email" size={24} />
            Обратная связь
          </h2>
        </div>

        <div className="contact-panel__content">
          <ContactForm onSuccess={onClose} initialSubject={initialSubject} initialMessage={initialMessage} />
        </div>
      </div>

      {/* Floating close button */}
      {isOpen && (
        <button
          className="floating-btn floating-btn--contact floating-btn--active"
          onClick={onClose}
          aria-label="Закрыть форму обратной связи"
          title="Закрыть"
        >
          <Icon name="x" size={20} />
        </button>
      )}
    </>
  );
};
