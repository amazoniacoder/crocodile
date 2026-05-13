/**
 * BlogPro Textarea Component
 * Textarea matching old system structure
 */

import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  success?: boolean;
  className?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  error = false,
  success = false,
  className = '',
  ...props
}) => {
  const textareaClasses = [
    'textarea',
    error && 'textarea--error',
    success && 'textarea--success',
    className
  ].filter(Boolean).join(' ');

  return (
    <textarea
      className={textareaClasses}
      {...props}
    />
  );
};

export default Textarea;
