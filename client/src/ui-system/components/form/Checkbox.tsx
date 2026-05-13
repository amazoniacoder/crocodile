/**
 * BlogPro Checkbox Component
 * Universal checkbox component
 */

import React from 'react';
import { Icon } from '../../icons/components';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'card';
  indeterminate?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  size = 'md',
  variant = 'default',
  indeterminate = false,
  className = '',
  ...props
}) => {
  const checkboxClasses = [
    'checkbox',
    `checkbox--${size}`,
    `checkbox--${variant}`,
    props.disabled && 'checkbox--disabled',
    className
  ].filter(Boolean).join(' ');

  const iconSize = {
    sm: 12,
    md: 14,
    lg: 16
  }[size];

  return (
    <label className={checkboxClasses}>
      <input
        type="checkbox"
        className="checkbox__input"
        {...props}
      />
      <div className="checkbox__box">
        {(props.checked || indeterminate) && (
          <Icon 
            name={indeterminate ? 'delete' : 'save'} 
            size={iconSize}
            className="checkbox__icon"
          />
        )}
      </div>
      {label && (
        <span className="checkbox__label text-sm">{label}</span>
      )}
    </label>
  );
};

export default Checkbox;
