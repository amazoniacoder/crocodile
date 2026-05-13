import React from 'react';

interface TextareaProps {
  value: string | undefined;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
  maxLength?: number;
  ref?: React.RefObject<HTMLTextAreaElement>;
}

export type { TextareaProps };

export const Textarea = React.forwardRef<HTMLTextAreaElement, Omit<TextareaProps, 'ref'>>((
  {
    value,
    onChange,
    placeholder,
    rows = 3,
    className = '',
    disabled = false,
    maxLength
  },
  ref
) => {
  return (
    <textarea
      ref={ref}
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      maxLength={maxLength}
      className={`textarea ${className}`}
      style={{
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        fontSize: '14px',
        fontFamily: 'inherit',
        resize: 'vertical'
      }}
    />
  );
});