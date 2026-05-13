/**
 * BlogPro Mobile Menu Component
 * Universal mobile navigation
 */

import React, { useState } from 'react';
import { Icon } from '../../icons/components';
import { Navigation, NavigationItem } from './Navigation';
import './mobile-menu.css';

export interface MobileMenuProps {
  items: NavigationItem[];
  className?: string;
  onClose?: () => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({
  items,
  className = '',
  onClose
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
    if (!isOpen && onClose) {
      onClose();
    }
  };

  const menuClasses = [
    'mobile-menu',
    isOpen && 'mobile-menu--open',
    className
  ].filter(Boolean).join(' ');

  return (
    <>
      <button
        className="mobile-menu__toggle"
        onClick={toggleMenu}
        aria-label="Toggle mobile menu"
      >
        <Icon name={isOpen ? 'delete' : 'hamburger'} size={24} />
      </button>

      <div className={menuClasses}>
        {isOpen && <div className="mobile-menu__overlay" onClick={toggleMenu} />}
        <div className="mobile-menu__content">
          <div className="mobile-menu__header">
            <button
              className="mobile-menu__close"
              onClick={toggleMenu}
              aria-label="Close mobile menu"
            >
              <Icon name="delete" size={24} />
            </button>
          </div>
          <Navigation 
            items={items} 
            variant="vertical"
            className="mobile-menu__navigation"
          />
        </div>
      </div>
    </>
  );
};

export default MobileMenu;
