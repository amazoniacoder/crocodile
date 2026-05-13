import React from 'react';

interface HamburgerMenuProps {
  isOpen: boolean;
  onClick: () => void;
  className?: string;
}

export const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ 
  isOpen, 
  onClick, 
  className = '' 
}) => {
  return (
    <button
      className={`header__hamburger ${isOpen ? 'header__hamburger--active' : ''} ${className}`}
      onClick={onClick}
      aria-label="Toggle menu"
      aria-expanded={isOpen}
    >
      <div className="header__hamburger-box">
        <div className="header__hamburger-inner"></div>
      </div>
    </button>
  );
};
