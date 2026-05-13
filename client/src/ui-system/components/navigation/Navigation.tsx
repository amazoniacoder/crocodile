/**
 * BlogPro Navigation Component
 * Universal navigation for frontend and admin
 */

import React from 'react';
import { Icon, IconName } from '../../icons/components';
import './navigation.css';

export interface NavigationItem {
  id: string;
  label: string;
  href?: string;
  icon?: IconName;
  active?: boolean;
  children?: NavigationItem[];
  onClick?: () => void;
}

export interface NavigationProps {
  items: NavigationItem[];
  variant?: 'horizontal' | 'vertical' | 'admin';
  className?: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  items,
  variant = 'horizontal',
  className = ''
}) => {
  const navClasses = [
    'navigation',
    `navigation--${variant}`,
    className
  ].filter(Boolean).join(' ');

  const renderItem = (item: NavigationItem) => {
    const itemClasses = [
      'navigation__item',
      item.active && 'navigation__item--active'
    ].filter(Boolean).join(' ');

    const content = (
      <>
        {item.icon && (
          <Icon 
            name={item.icon} 
            size={16} 
            className="navigation__icon" 
          />
        )}
        <span className="navigation__label">{item.label}</span>
      </>
    );

    if (item.href) {
      return (
        <a
          key={item.id}
          href={item.href}
          className={`navigation__link ${itemClasses}`}
          onClick={item.onClick}
        >
          {content}
        </a>
      );
    }

    return (
      <button
        key={item.id}
        className={`navigation__button ${itemClasses}`}
        onClick={item.onClick}
      >
        {content}
      </button>
    );
  };

  return (
    <nav className={navClasses}>
      <ul className="navigation__list">
        {items.map(item => (
          <li key={item.id} className="navigation__list-item">
            {renderItem(item)}
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navigation;
