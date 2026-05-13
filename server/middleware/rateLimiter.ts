import rateLimit from 'express-rate-limit';

// Rate limiter для Footer API endpoints
export const footerApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов с одного IP за окно
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Don't count successful requests
  skipFailedRequests: false, // Don't count failed requests
});

// Более строгий лимит для операций создания/обновления
export const footerMutationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 минут
  max: 20, // максимум 20 операций записи за 5 минут
  message: {
    success: false,
    message: 'Too many write operations, please slow down',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Лимит для preview операций
export const footerPreviewLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 минута
  max: 30, // максимум 30 preview запросов в минуту
  message: {
    success: false,
    message: 'Too many preview requests, please wait',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});