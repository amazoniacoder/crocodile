import React from 'react';
import { Spinner } from '@/ui-system/components/feedback';
import { Text } from '@/ui-system/components/typography';

export interface LoadingPageProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingPage: React.FC<LoadingPageProps> = ({ 
  message = 'Загрузка...', 
  size = 'lg',
  className = '' 
}) => {
  return (
    <div className={`loading-page ${className}`}>
      <div className="container">
        <div className="loading-page__content">
          <Spinner size={size} />
          <Text className="loading-page__message">{message}</Text>
        </div>
      </div>
    </div>
  );
};
