import type { Request, Response, NextFunction } from 'express';
import { userTokenService } from '../infrastructure/auth/UserTokenService';
import rateLimit from 'express-rate-limit';

// Расширяем Request для добавления userTokenId и isAdmin
declare global {
  namespace Express {
    interface Request {
      userTokenId?: number;
      isAdmin?: boolean;
    }
  }
}

/**
 * Middleware для аутентификации по user token
 * Читает токен из query ?token=ut_... или header X-User-Token
 */
export async function authenticateUserToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = (req.query.token as string) || req.headers['x-user-token'] as string;

  if (!token) {
    res.status(401).json({ error: 'Token required' });
    return;
  }

  const result = await userTokenService.validateToken(token);

  if (!result.valid || !result.tokenId) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.userTokenId = result.tokenId;
  req.isAdmin = result.isAdmin ?? false;
  next();
}

/**
 * Rate limiting для user token API (120 req/мин по токену)
 */
export const userTokenRateLimit = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const token = (req.query.token as string) || req.headers['x-user-token'] as string;
    return token || req.ip || 'unknown';
  },
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
    });
  },
});
