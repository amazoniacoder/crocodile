/**
 * BlogPro Spacer Component
 * Universal spacing utility component
 */

import React from 'react';

export interface SpacerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  axis?: 'x' | 'y' | 'both';
  className?: string;
}

export const Spacer: React.FC<SpacerProps> = ({
  size = 'md',
  axis = 'y',
  className = ''
}) => {
  const spacerClasses = [
    'spacer',
    `spacer--${size}`,
    `spacer--${axis}`,
    className
  ].filter(Boolean).join(' ');

  return <div className={spacerClasses} aria-hidden="true" />;
};

export default Spacer;
