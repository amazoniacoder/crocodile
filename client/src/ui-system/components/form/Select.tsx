import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ options = [], className = '', children, ...props }) => (
  <select className={`select ${className}`} {...props}>
    {children || options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

export const SelectTrigger = Select;
export const SelectContent: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;
export const SelectItem: React.FC<{ value: string; children?: React.ReactNode }> = ({ value, children }) => <option value={value}>{children}</option>;
export const SelectValue: React.FC<{ placeholder?: string }> = ({ placeholder }) => <option value="">{placeholder}</option>;
export const SelectGroup: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;
export const SelectLabel: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;
export const SelectSeparator: React.FC = () => null;
export const SelectScrollUpButton: React.FC = () => null;
export const SelectScrollDownButton: React.FC = () => null;

export type { SelectProps as SelectTriggerProps, SelectProps as SelectContentProps };
