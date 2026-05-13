import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  onClick?: () => void;
  id?: string;
}

export type { CardProps };

export const Card: React.FC<CardProps> = ({
  children,
  title,
  className = '',
  onClick,
  id
}) => {
  return (
    <div 
      id={id}
      className={`card ${className}`}
      onClick={onClick}
      style={{
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
    >
      {title && <h3 className="card__title">{title}</h3>}
      <div className="card__content">
        {children}
      </div>
    </div>
  );
};