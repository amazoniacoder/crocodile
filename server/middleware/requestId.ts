import { Request, Response, NextFunction } from 'express';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Generate unique request ID if not provided
  const requestId = req.headers['x-request-id'] as string || 
    Math.random().toString(36).substring(2) + Date.now().toString(36);
  
  // Add to request headers for use in error handling
  req.headers['x-request-id'] = requestId;
  
  // Add to response headers for client tracking
  res.setHeader('X-Request-ID', requestId);
  
  next();
}