// client/src/utils/errorHandler.ts
interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

/**
 * Centralized error handler for API errors
 */
export class ErrorHandler {
  /**
   * Formats an error into a standardized ApiError object
   */
  static formatError(error: unknown, defaultMessage = 'An unexpected error occurred'): ApiError {
    if (error && typeof error === 'object') {
      // If it's already an ApiError, return it
      if ('message' in error && typeof error.message === 'string') {
        return {
          message: error.message,
          code: 'code' in error ? String(error.code) : 'UNKNOWN_ERROR',
          status: 'status' in error ? Number(error.status) : 500
        };
      }
      
      // Handle Error objects
      if (error instanceof Error) {
        return {
          message: error.message,
          code: 'UNKNOWN_ERROR',
          status: 500
        };
      }
    }
    
    // Default case
    return {
      message: defaultMessage,
      code: 'UNKNOWN_ERROR',
      status: 500
    };
  }

  /**
   * Logs an error to the console with consistent formatting
   */
  static logError(context: string, error: unknown): void {
    const formattedError = this.formatError(error);
    console.error(
      `[${context}] ${formattedError.message}`,
      formattedError.code ? `(Code: ${formattedError.code})` : '',
      error
    );
  }
}
