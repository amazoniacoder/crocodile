/**
 * BlogPro Stack Component
 * Flexible layout utility component
 */

import React from 'react';

export interface StackProps {
  children: React.ReactNode;
  direction?: 'row' | 'column';
  spacing?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
  className?: string;
}

export const Stack: React.FC<StackProps> = ({
  children,
  direction = 'column',
  spacing = 'md',
  align = 'stretch',
  justify = 'start',
  wrap = false,
  className = ''
}) => {
  const stackClasses = [
    'stack',
    'flex',
    `stack--${direction}`,
    direction === 'column' && 'flex-col',
    `stack--spacing-${spacing}`,
    `stack--align-${align}`,
    `stack--justify-${justify}`,
    wrap && 'stack--wrap',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={stackClasses}>
      {children}
    </div>
  );
};

export default Stack;
