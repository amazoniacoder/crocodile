/**
 * BlogPro Error Page Pattern
 * Standardized error page layout
 */

import React from 'react';
import { Link } from 'wouter';
import { Button } from '../components/button';
import { Heading, Text } from '../components/typography';

export interface ErrorPageProps {
  code: string;
  title: string;
  description: string;
  actions?: Array<{
    label: string;
    href: string;
    variant?: 'primary' | 'secondary';
  }>;
  illustration?: React.ReactNode;
  className?: string;
}

export const ErrorPage: React.FC<ErrorPageProps> = ({
  code,
  title,
  description,
  actions = [],
  illustration,
  className = ''
}) => {
  return (
    <div className={`error-page ${className}`}>
      <div className="error-page__content">
        <Heading level={1} className="error-page__code leading-none">{code}</Heading>
        <Heading level={2} className="error-page__title">{title}</Heading>
        <Text className="error-page__description">{description}</Text>
        
        {actions.length > 0 && (
          <div className="error-page__actions">
            {actions.map((action, index) => (
              <Link key={index} href={action.href}>
                <Button variant={action.variant || 'primary'}>
                  {action.label}
                </Button>
              </Link>
            ))}
          </div>
        )}
      </div>
      
      {illustration && (
        <div className="error-page__illustration">
          {illustration}
        </div>
      )}
    </div>
  );
};

export default ErrorPage;
