/**
 * BlogPro FormField Component
 * Unified form field system with TypeScript support
 */

import React from 'react';

export interface FormFieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  floating?: boolean;
  focused?: boolean;
  hasValue?: boolean;
  className?: string;
  children: React.ReactNode;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // No size prop to match old system
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  // No size prop to match old system
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required = false,
  error,
  floating = false,
  focused = false,
  hasValue = false,
  className = '',
  children
}) => {
  const fieldClasses = [
    'form-field',
    'relative',
    floating && 'form-field--floating',
    focused && 'form-field--focused',
    error && 'form-field--error',
    className
  ].filter(Boolean).join(' ');

  const labelClasses = [
    'form-field__label',
    hasValue && 'form-field__label--has-value'
  ].filter(Boolean).join(' ');

  return (
    <div className={fieldClasses}>
      {label && (
        <label className={labelClasses}>
          {label}
          {required && <span className="form-field__required">*</span>}
        </label>
      )}
      {children}
      
      {error && (
        <div className="form-field__error">
          {error}
        </div>
      )}
    </div>
  );
};

export const Input: React.FC<InputProps> = ({
  className = '',
  ...props
}) => {
  const inputClasses = [
    'form-field__input',
    'border',
    className
  ].filter(Boolean).join(' ');

  return (
    <input
      className={inputClasses}
      {...props}
    />
  );
};

export const Textarea: React.FC<TextareaProps> = ({
  className = '',
  ...props
}) => {
  const textareaClasses = [
    'form-field__input',
    'form-field__input--textarea',
    'border',
    className
  ].filter(Boolean).join(' ');

  return (
    <textarea
      className={textareaClasses}
      {...props}
    />
  );
};

export const Select: React.FC<SelectProps> = ({
  className = '',
  children,
  ...props
}) => {
  const selectClasses = [
    'form-field__input',
    'border',
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
