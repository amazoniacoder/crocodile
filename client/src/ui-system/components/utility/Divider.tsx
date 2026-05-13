/**
 * BlogPro Divider Component
 * Universal visual divider component
 */

import React from 'react';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  variant?: 'solid' | 'dashed' | 'dotted';
  spacing?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  variant = 'solid',
  spacing = 'md',
  className = ''
}) => {
  const dividerClasses = [
    'divider',
    `divider--${orientation}`,
    `divider--${variant}`,
    `divider--${spacing}`,
    orientation === 'vertical' && 'h-full',
    spacing === 'sm' && orientation === 'horizontal' && 'my-2',
    spacing === 'sm' && orientation === 'vertical' && 'mx-2',
    className
  ].filter(Boolean).join(' ');

  return <div className={dividerClasses} role="separator" />;
};

export default Divider;
