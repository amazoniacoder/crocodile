import React from 'react';

export interface ButtonProps {
  children?: React.ReactNode;
  onClick?: (e?: React.MouseEvent) => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
  style?: React.CSSProperties;
  title?: string;
  // Extended props for compatibility
  as?: 'button' | 'a';
  href?: string;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  fullWidth = false,
  style,
  title,
  as = 'button',
  href,
  loading = false,
  ...props
}) => {
  const baseClasses = 'button';
  const variantClasses = `button--${variant}`;
  const sizeClasses = `button--${size}`;
  const fullWidthClass = fullWidth ? 'button--full-width' : '';
  const loadingClass = loading ? 'button--loading' : '';
  
  const classes = [baseClasses, variantClasses, sizeClasses, fullWidthClass, loadingClass, className]
    .filter(Boolean)
    .join(' ');

  const isDisabled = disabled || loading;

  // Render as link if href is provided or as prop is 'a'
  if (as === 'a' || href) {
    return (
      <a
        href={href}
        onClick={onClick}
        className={classes}
        style={style}
        title={title}
        {...(isDisabled && { 'aria-disabled': true })}
        {...props}
      >
        {loading && <span className="button__spinner" />}
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={classes}
      style={style}
      title={title}
      {...props}
    >
      {loading && <span className="button__spinner" />}
      {children}
    </button>
  );
};

export default Button;