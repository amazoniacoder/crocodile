/**
 * BlogPro Header Component
 * Universal header with smart navigation overflow management
 */

import React, { useEffect, useRef } from 'react';
import { Icon } from '../../icons/components';
import { useHeader, NavigationItem } from './HeaderContext';
import { SmartNavigation } from './SmartNavigation';
import './header.css';

export interface HeaderProps {
  variant?: 'frontend' | 'admin';
  logo?: React.ReactNode;
  navigationItems?: NavigationItem[];
  menuItems?: any[];
  actions?: React.ReactNode;
  persistentActions?: React.ReactNode;
  slideMenuActions?: React.ReactNode;
  onNavClick?: (href: string) => void;
  activeHref?: string;
  className?: string;
  sticky?: boolean;
  transparent?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  variant = 'frontend',
  logo,
  navigationItems = [],
  menuItems = [],
  actions,
  persistentActions,
  slideMenuActions,
  onNavClick,
  activeHref,
  className = '',
  sticky = false,
  transparent = false
}) => {
  const { slideMenuOpen, mobileMenuOpen, overflowItems, toggleSlideMenu, toggleMobileMenu } = useHeader();
  const slideMenuRef = useRef<HTMLDivElement>(null);
  const slideToggleRef = useRef<HTMLButtonElement>(null);
  const [isScrolled, setIsScrolled] = React.useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled((window.pageYOffset || document.documentElement.scrollTop) > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (slideMenuOpen &&
          slideMenuRef.current &&
          slideToggleRef.current &&
          !slideMenuRef.current.contains(event.target as Node) &&
          !slideToggleRef.current.contains(event.target as Node)) {
        toggleSlideMenu();
      }
    };
    if (slideMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [slideMenuOpen, toggleSlideMenu]);

  const headerClasses = [
    'header',
    `header--${variant}`,
    sticky && 'header--sticky',
    transparent && 'header--transparent',
    slideMenuOpen && 'header--slide-open',
    isScrolled && 'header--scrolled',
    className
  ].filter(Boolean).join(' ');

  return (
    <header className={headerClasses}>
      <div className="header__container">
        {logo && <div className="header__logo">{logo}</div>}

        <div className={`header__nav ${mobileMenuOpen ? 'header__nav--open' : ''}`}>
          <SmartNavigation
            items={navigationItems}
            menuItems={menuItems}
            onLinkClick={() => {
              if (mobileMenuOpen) toggleMobileMenu();
              requestAnimationFrame(() => {
                const feedList = document.querySelector('.news-feed__list') as HTMLElement | null;
                if (feedList) feedList.scrollTo({ top: 0, behavior: 'smooth' });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              });
            }}
            onNavClick={onNavClick}
            activeHref={activeHref}
          />
          <div className="header__mobile-actions hidden">
            {persistentActions}
            {actions}
          </div>
        </div>

        <div className="header__actions header__actions--desktop">
          {persistentActions}
          {slideMenuOpen && overflowItems.length > 0 && (
            <button
              className="header__overflow-toggle transition"
              onClick={toggleSlideMenu}
              aria-label={`Show ${overflowItems.length} hidden menu items`}
            >
              <Icon name="hamburger" size={20} />
              <span className="header__overflow-count leading-none">{overflowItems.length}</span>
            </button>
          )}

          <button
            ref={slideToggleRef}
            className={`header__slide-toggle transition ${slideMenuOpen ? 'header__slide-toggle--open' : ''}`}
            onClick={toggleSlideMenu}
            aria-label="Toggle slide menu"
          >
            <Icon name="arrow-left" className="header__triangle-icon" />
          </button>

          <div ref={slideMenuRef} className={`header__slide-menu hidden ${slideMenuOpen ? 'header__slide-menu--open' : ''}`}>
            {slideMenuActions || actions}
          </div>

          <button
            className={`header__hamburger hidden ${mobileMenuOpen ? 'header__hamburger--active' : ''}`}
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            <span className="header__hamburger-box">
              <span className="header__hamburger-inner"></span>
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
