// client/src/hooks/useErrorHandler.ts
import { useState, useCallback } from 'react';
import { ErrorHandler } from '@/utils/errorHandler';

/**
 * Hook for consistent error handling across components
 */
export const useErrorHandler = (context: string) => {
  const [error, setError] = useState<Error | null>(null);
  const [isError, setIsError] = useState(false);

  const handleError = useCallback((err: unknown, defaultMessage?: string) => {
    const formattedError = ErrorHandler.formatError(err, defaultMessage);
    ErrorHandler.logError(context, err);
    const errorObj = new Error(formattedError.message);
    errorObj.name = formattedError.code || 'Error';
    setError(errorObj);
    setIsError(true);
    return formattedError;
  }, [context]);

  const clearError = useCallback(() => {
    setError(null);
    setIsError(false);
  }, []);

  return {
    error,
    isError,
    handleError,
    clearError
  };
};
