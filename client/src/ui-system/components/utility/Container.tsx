/**
 * BlogPro Container Component
 * Enhanced container with responsive behavior
 */

import React from 'react';

export interface ContainerProps {
  children: React.ReactNode;
  size?: 'sm' | 'lg' | 'xl' | 'fluid';
  className?: string;
}

export const Container: React.FC<ContainerProps> = ({
  children,
  size,
  className = ''
}) => {
  const containerClasses = [
    'container',
    size && `container--${size}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {children}
    </div>
  );
};

export default Container;
