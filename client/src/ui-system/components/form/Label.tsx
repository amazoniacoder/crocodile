import React from 'react';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label: React.FC<LabelProps> = ({ children, required, className = '', ...props }) => (
  <label className={`label ${className}`} {...props}>
    {children}
    {required && <span className="label__required" aria-hidden="true"> *</span>}
  </label>
);
