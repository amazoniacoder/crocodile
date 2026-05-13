/**
 * BlogPro Code Component
 * Universal code display component
 */

import React from 'react';
import './typography.css';

export interface CodeProps {
  children: React.ReactNode;
  variant?: 'inline' | 'block';
  language?: string;
  className?: string;
}

export const Code: React.FC<CodeProps> = ({
  children,
  variant = 'inline',
  language,
  className = ''
}) => {
  const codeClasses = [
    'code',
    `code--${variant}`,
    language && `code--${language}`,
    className
  ].filter(Boolean).join(' ');

  if (variant === 'block') {
    return (
      <pre className={`bp-code-block ${className}`}>
        <code className={codeClasses}>
          {children}
        </code>
      </pre>
    );
  }

  return (
    <code className={codeClasses}>
      {children}
    </code>
  );
};

export default Code;
