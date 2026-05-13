/**
 * BlogPro Link Component
 * Universal link component
 */

import React from 'react';
import './typography.css';

export interface LinkProps {
  href?: string;
  children: React.ReactNode;
  variant?: 'default' | 'button' | 'subtle';
  external?: boolean;
  className?: string;
  onClick?: () => void;
}

export const Link: React.FC<LinkProps> = ({
  href,
  children,
  variant = 'default',
  external = false,
  className = '',
  onClick
}) => {
  const linkClasses = [
    'link',
    `link--${variant}`,
    className
  ].filter(Boolean).join(' ');

  const linkProps = {
    className: linkClasses,
    onClick,
    ...(external && {
      target: '_blank',
      rel: 'noopener noreferrer'
    })
  };

  if (href) {
    return (
      <a href={href} {...linkProps}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" {...linkProps}>
      {children}
    </button>
  );
};

export default Link;
