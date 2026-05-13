/**
 * BlogPro Select Component
 * Select dropdown matching old system structure
 */

import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  success?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({
  error = false,
  success = false,
  className = '',
  children,
  ...props
}) => {
  const selectClasses = [
    'select-trigger',
    error && 'select-trigger--error',
    success && 'select-trigger--success',
    className
  ].filter(Boolean).join(' ');

  return (
    <select
      className={selectClasses}
      {...props}
    >
      {children}
    </select>
  );
};

export default Select;
