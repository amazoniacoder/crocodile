/**
 * BlogPro Enhanced Card Component
 * Compound Components Pattern
 */

import React, { createContext } from 'react';

// Card Context
interface CardContextValue {
  variant: CardVariant;
  padding: CardPadding;
}

const CardContext = createContext<CardContextValue | null>(null);

// Types
export type CardVariant = 'default' | 'outlined' | 'elevated' | 'filled';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  hoverable?: boolean;
}

// Main Card Component
export const Card: React.FC<CardProps> & {
  Header: typeof CardHeader;
  Title: typeof CardTitle;
  Description: typeof CardDescription;
  Content: typeof CardContent;
  Actions: typeof CardActions;
  Footer: typeof CardFooter;
  Image: typeof CardImage;
} = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  style,
  onClick,
  hoverable = false,
  ...props
}) => {
  const cardClasses = [
    'card',
    `card--${variant}`,
    `card--padding-${padding}`,
    hoverable && 'card--hoverable',
    onClick && 'card--clickable',
    className
  ].filter(Boolean).join(' ');

  const contextValue: CardContextValue = {
    variant,
    padding
  };

  return (
    <CardContext.Provider value={contextValue}>
      <div
        className={cardClasses}
        style={style}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        {...props}
      >
        {children}
      </div>
    </CardContext.Provider>
  );
};

// Card Header
interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  className = ''
}) => {
  const headerClasses = ['card__header', className].filter(Boolean).join(' ');
  
  return (
    <div className={headerClasses}>
      {children}
    </div>
  );
};

// Card Title
interface CardTitleProps {
  children: React.ReactNode;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
}

const CardTitle: React.FC<CardTitleProps> = ({
  children,
  level = 3,
  className = ''
}) => {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  const titleClasses = ['card__title', className].filter(Boolean).join(' ');
  
  return (
    <Tag className={titleClasses}>
      {children}
    </Tag>
  );
};

// Card Description
interface CardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

const CardDescription: React.FC<CardDescriptionProps> = ({
  children,
  className = ''
}) => {
  const descClasses = ['card__description', className].filter(Boolean).join(' ');
  
  return (
    <p className={descClasses}>
      {children}
    </p>
  );
};

// Card Content
interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

const CardContent: React.FC<CardContentProps> = ({
  children,
  className = ''
}) => {
  const contentClasses = ['card__content', className].filter(Boolean).join(' ');
  
  return (
    <div className={contentClasses}>
      {children}
    </div>
  );
};

// Card Actions
interface CardActionsProps {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right' | 'between';
  className?: string;
}

const CardActions: React.FC<CardActionsProps> = ({
  children,
  align = 'right',
  className = ''
}) => {
  const actionsClasses = [
    'card__actions',
    `card__actions--${align}`,
    className
  ].filter(Boolean).join(' ');
  
  return (
    <div className={actionsClasses}>
      {children}
    </div>
  );
};

// Card Footer
interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

const CardFooter: React.FC<CardFooterProps> = ({
  children,
  className = ''
}) => {
  const footerClasses = ['card__footer', className].filter(Boolean).join(' ');
  
  return (
    <div className={footerClasses}>
      {children}
    </div>
  );
};

// Card Image
interface CardImageProps {
  src: string;
  alt: string;
  aspectRatio?: '16/9' | '4/3' | '1/1' | 'auto';
  objectFit?: 'cover' | 'contain' | 'fill';
  className?: string;
}

const CardImage: React.FC<CardImageProps> = ({
  src,
  alt,
  aspectRatio = '16/9',
  objectFit = 'cover',
  className = ''
}) => {
  const imageClasses = [
    'card__image',
    `card__image--${aspectRatio.replace('/', '-')}`,
    `card__image--${objectFit}`,
    className
  ].filter(Boolean).join(' ');
  
  return (
    <div className={imageClasses}>
      <img src={src} alt={alt} />
    </div>
  );
};

// Attach subcomponents
Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Content = CardContent;
Card.Actions = CardActions;
Card.Footer = CardFooter;
Card.Image = CardImage;

export default Card;