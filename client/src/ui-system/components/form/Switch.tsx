/**
 * BlogPro Switch — та же разметка, что в кабинете мониторинга (ToggleSwitch):
 * button.monitor-switch + span.monitor-switch__thumb
 */

import React from 'react';

export interface SwitchProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'type' | 'role' | 'aria-checked' | 'children' | 'onChange'
  > {
  checked?: boolean;
  /** Совместимость с прежним API input-switch: в событии target.checked = следующее значение */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Switch: React.FC<SwitchProps> = ({
  label,
  size: _size = 'md',
  className = '',
  checked = false,
  disabled,
  onChange,
  onClick,
  id,
  ...rest
}) => {
  const classes = [
    'monitor-switch',
    checked && 'monitor-switch--on',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const button = (
    <button
      type="button"
      id={id}
      className={classes}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        onClick?.(e);
        if (disabled || e.defaultPrevented) return;
        onChange?.({
          target: { checked: !checked },
        } as React.ChangeEvent<HTMLInputElement>);
      }}
      {...rest}
    >
      <span className="monitor-switch__thumb" />
    </button>
  );

  if (!label) return button;

  return (
    <span className="monitor-switch-field">
      {button}
      <span className="monitor-switch__label text-sm">{label}</span>
    </span>
  );
};

export default Switch;
