/**
 * BlogPro Text Component
 * Universal text component (p, span, etc.)
 */

import React from 'react';
import './typography.css';

export interface TextProps {
  as?: 'p' | 'span' | 'div' | 'small' | 'strong' | 'em';
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: 'primary' | 'secondary' | 'muted' | 'error' | 'success' | 'warning';
  align?: 'left' | 'center' | 'right' | 'justify';
  children: React.ReactNode;
  className?: string;
}

export const Text: React.FC<TextProps> = ({
  as: Tag = 'p',
  size = 'base',
  weight = 'normal',
  color = 'primary',
  align = 'left',
  children,
  className = ''
}) => {
  const textClasses = [
    'text',
    `text--${size}`,
    `text--${weight}`,
    `text--${color}`,
    `text--${align}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <Tag className={textClasses}>
      {children}
    </Tag>
  );
};

export default Text;
