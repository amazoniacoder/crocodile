/**
 * BlogPro IconButton Component
 * Button component with integrated icon system
 */

import React from 'react';
import { Icon, IconProps } from './Icon';

export interface IconButtonProps extends Omit<IconProps, 'onClick'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  'aria-label'?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  name,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  onClick,
  className = '',
  'aria-label': ariaLabel,
  ...iconProps
}) => {
  const sizeMap = {
    sm: 16,
    md: 20,
    lg: 24
  };

  return (
    <button
      className={`icon-button icon-button--${variant} icon-button--${size} ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || name}
      type="button"
    >
      <Icon
        name={name}
        size={sizeMap[size]}
        {...iconProps}
      />
    </button>
  );
};

export default IconButton;
