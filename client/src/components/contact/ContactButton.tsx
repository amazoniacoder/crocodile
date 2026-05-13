import React from 'react';
import { Icon } from '@/ui-system/icons/components';

interface ContactButtonProps {
  onClick: (e: React.MouseEvent) => void;
  isOpen: boolean;
}

export const ContactButton: React.FC<ContactButtonProps> = ({ onClick, isOpen }) => {
  return (
    <button
      className={`floating-btn floating-btn--contact ${isOpen ? 'floating-btn--active' : ''}`}
      onClick={onClick}
      aria-label={isOpen ? 'Закрыть форму обратной связи' : 'Открыть форму обратной связи'}
      title={isOpen ? 'Закрыть' : 'Обратная связь'}
    >
      <Icon name={isOpen ? 'x' : 'email'} size={20} />
    </button>
  );
};
