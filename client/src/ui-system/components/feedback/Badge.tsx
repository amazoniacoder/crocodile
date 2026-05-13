/**
 * BlogPro Badge Component
 * Universal status badges
 */

import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'error' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  outline?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant,
  size = 'md',
  outline = false,
  className = ''
}) => {
  const badgeClasses = [
    'badge',
    variant && `badge--${variant}`,
    size !== 'md' && `badge--${size}`,
    outline && 'badge--outline',
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={badgeClasses}>
      {children}
    </span>
  );
};

export default Badge;
