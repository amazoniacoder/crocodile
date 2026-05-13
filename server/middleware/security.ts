import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { Request, Response, NextFunction } from 'express';

// Rate limiting middleware
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for auth endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS configuration
export const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.CORS_ORIGIN || 'https://blogpro.tech', 'https://blogpro.tech', 'https://www.blogpro.tech']
    : ['https://blogpro.tech', 'http://localhost:3000', 'https://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};

export const corsMiddleware = cors(corsOptions);

// Security headers middleware
export const securityHeadersMiddleware = (_req: Request, res: Response, next: NextFunction) => {
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "script-src 'self'; " +
    "img-src 'self' data: https: blob:; " +
    "connect-src 'self' ws: wss:; " +
    "font-src 'self'; " +
    "object-src 'none'; " +
    "media-src 'self'; " +
    "frame-src 'none'"
  );
  
  // HTTP Strict Transport Security
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // X-Frame-Options
  res.setHeader('X-Frame-Options', 'DENY');
  
  // X-XSS-Protection (disabled as per modern security standards)
  res.setHeader('X-XSS-Protection', '0');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'no-referrer');
  
  next();
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        obj[key] = sanitize(obj[key]);
      }
    }
    return obj;
  };

  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);
  
  next();
};

// Admin authentication middleware
export const authenticateAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Try new token management system first
    const { tokenManager } = await import('../infrastructure/auth/TokenManager');
    const validation = await tokenManager.validateToken(token);
    
    if (validation.isValid) {
      // Add token info to request for audit logging
      (req as any).tokenInfo = {
        tokenId: validation.tokenId,
        name: validation.name,
        permissions: validation.permissions
      };
      return next();
    }
    
    // Fallback to legacy ADMIN_TOKEN for backward compatibility
    if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) {
      (req as any).tokenInfo = {
        tokenId: 'legacy',
        name: 'Legacy Token',
        permissions: ['admin']
      };
      return next();
    }
    
    return res.status(401).json({ error: 'Invalid token' });
  } catch (error) {
    if (import.meta.env?.DEV) console.error('Token validation error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};