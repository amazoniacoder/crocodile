import { Response } from 'express';

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

export const sendErrorResponse = (
  res: Response,
  statusCode: number,
  message: string,
  error?: string
): void => {
  const errorResponse: ErrorResponse = {
    error: error || 'Error',
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(errorResponse);
};

export const handleValidationError = (res: Response, error: any): void => {
  sendErrorResponse(res, 400, 'Validation failed', error.message);
};

export const handleNotFound = (res: Response, resource: string): void => {
  sendErrorResponse(res, 404, `${resource} not found`);
};

export const handleUnauthorized = (res: Response): void => {
  sendErrorResponse(res, 401, 'Unauthorized access');
};

export const handleForbidden = (res: Response): void => {
  sendErrorResponse(res, 403, 'Access forbidden');
};

export const handleServerError = (res: Response, error?: string): void => {
  sendErrorResponse(res, 500, 'Internal server error', error);
};