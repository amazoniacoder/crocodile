/**
 * BlogPro Spinner Component
 * Universal loading spinner
 */

import React from 'react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'dots' | 'pulse';
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  variant = 'default',
  className = ''
}) => {
  const spinnerClasses = [
    'spinner',
    `spinner--${size}`,
    `spinner--${variant}`,
    className
  ].filter(Boolean).join(' ');

  if (variant === 'dots') {
    return (
      <div className={spinnerClasses}>
        <div className="spinner__dot" />
        <div className="spinner__dot" />
        <div className="spinner__dot" />
      </div>
    );
  }

  if (variant === 'pulse') {
    return <div className={spinnerClasses} />;
  }

  return (
    <div className={spinnerClasses}>
      <div className="spinner__circle" />
    </div>
  );
};

export default Spinner;
