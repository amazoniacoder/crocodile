import { Request, Response, NextFunction } from 'express';
import { 
  BadRequestError, 
  NotFoundError, 
  ValidationError, 
  UnauthorizedError 
} from '../../shared/utils/errors';

import { logger } from '../utils/logger';
import { createErrorResponse, ErrorCodes } from '../../shared/types/api-responses';

export function notFoundHandler(req: Request, res: Response, _next: NextFunction) {
  const errorResponse = createErrorResponse(
    ErrorCodes.NOT_FOUND,
    `Route ${req.originalUrl} not found`,
    { path: req.originalUrl, method: req.method },
    req.headers['x-request-id'] as string
  );
  res.status(404).json(errorResponse);
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string;
  
  logger.error('Application Error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    requestId
  });

  if (err instanceof BadRequestError) {
    const errorResponse = createErrorResponse(
      ErrorCodes.VALIDATION_ERROR,
      err.message,
      undefined,
      requestId
    );
    return res.status(400).json(errorResponse);
  }

  if (err instanceof NotFoundError) {
    const errorResponse = createErrorResponse(
      ErrorCodes.NOT_FOUND,
      err.message,
      undefined,
      requestId
    );
    return res.status(404).json(errorResponse);
  }

  if (err instanceof ValidationError) {
    const errorResponse = createErrorResponse(
      ErrorCodes.VALIDATION_ERROR,
      err.message,
      { errors: err.errors },
      requestId
    );
    return res.status(400).json(errorResponse);
  }

  if (err instanceof UnauthorizedError) {
    const errorResponse = createErrorResponse(
      ErrorCodes.UNAUTHORIZED,
      err.message,
      undefined,
      requestId
    );
    return res.status(401).json(errorResponse);
  }

  const message = process.env.NODE_ENV === 'development' ? err.message : 'Internal server error';
  const errorResponse = createErrorResponse(
    ErrorCodes.INTERNAL_ERROR,
    message,
    process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined,
    requestId
  );
  res.status(500).json(errorResponse);
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}