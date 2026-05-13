/**
 * BlogPro Form Component
 * Universal form system with BEM methodology
 */

import React from 'react';

export interface FormProps {
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  className?: string;
}

export const Form: React.FC<FormProps> = ({
  children,
  onSubmit,
  className = '',
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <form className={`form flex-col w-full ${className}`} onSubmit={handleSubmit}>
      {children}
    </form>
  );
};

export interface FormGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const FormGroup: React.FC<FormGroupProps> = ({ 
  children, 
  className = '' 
}) => {
  return <div className={`form__group flex-col ${className}`}>{children}</div>;
};

export interface FormLabelProps {
  children: React.ReactNode;
  htmlFor: string;
  className?: string;
}

export const FormLabel: React.FC<FormLabelProps> = ({ 
  children, 
  htmlFor, 
  className = '' 
}) => {
  return (
    <label htmlFor={htmlFor} className={`form__label ${className}`}>
      {children}
    </label>
  );
};

export interface FormMessageProps {
  children: React.ReactNode;
  type?: 'error' | 'success' | 'info';
  className?: string;
}

export const FormMessage: React.FC<FormMessageProps> = ({ 
  children, 
  type = 'info', 
  className = '' 
}) => {
  return (
    <div className={`form__message form__message--${type} ${className}`}>
      {children}
    </div>
  );
};

export interface FormActionsProps {
  children: React.ReactNode;
  className?: string;
}

export const FormActions: React.FC<FormActionsProps> = ({ 
  children, 
  className = '' 
}) => {
  return <div className={`form__actions ${className}`}>{children}</div>;
};

export default Form;
