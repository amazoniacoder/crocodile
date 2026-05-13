/**
 * BlogPro Heading Component
 * Universal heading component (H1-H6)
 */

import React from 'react';
import './typography.css';

export interface HeadingProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
  variant?: 'default' | 'display' | 'subtitle';
  className?: string;
  id?: string;
}

export const Heading: React.FC<HeadingProps> = ({
  level,
  children,
  variant = 'default',
  className = '',
  id
}) => {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  
  const headingClasses = [
    'heading',
    `heading--${level}`,
    `heading--${variant}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <Tag className={headingClasses} id={id}>
      {children}
    </Tag>
  );
};

export default Heading;
