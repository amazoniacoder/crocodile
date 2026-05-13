import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

/**
 * Конфигурация Content Security Policy
 */
const cspConfig = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'", // Для inline скриптов (можно убрать в production)
      ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : []), // Только для dev
      "https://mc.yandex.ru", // Яндекс.Метрика
      "https://www.googletagmanager.com", // Google Analytics
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // Для inline стилей
      "https://fonts.googleapis.com",
    ],
    imgSrc: [
      "'self'",
      "data:",
      "https:",
      "http:", // Для изображений из RSS
      "blob:",
    ],
    fontSrc: [
      "'self'",
      "https://fonts.gstatic.com",
      "data:",
    ],
    connectSrc: [
      "'self'",
      "ws:",
      "wss:",
      "https://mc.yandex.ru", // Яндекс.Метрика
      "https://www.google-analytics.com", // Google Analytics
    ],
    frameSrc: [
      "'none'"
    ],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    manifestSrc: ["'self'"],
    workerSrc: ["'self'"],
    childSrc: ["'none'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    upgradeInsecureRequests: [], // Принудительно HTTPS
  },
};

/**
 * Основной middleware для заголовков безопасности
 */
export const securityHeadersMiddleware = helmet({
  contentSecurityPolicy: cspConfig,
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 год
    includeSubDomains: true,
    preload: true,
  },
  
  // X-Frame-Options
  frameguard: {
    action: 'deny'
  },
  
  // X-Content-Type-Options
  noSniff: true,
  
  // X-XSS-Protection
  xssFilter: true,
  
  // Referrer Policy
  referrerPolicy: {
    policy: ['strict-origin-when-cross-origin']
  },
  
  // X-Permitted-Cross-Domain-Policies
  permittedCrossDomainPolicies: false,
  
  // X-DNS-Prefetch-Control
  dnsPrefetchControl: {
    allow: false
  },
  
  // Hide X-Powered-By
  hidePoweredBy: true,
});

/**
 * Дополнительные заголовки безопасности
 */
export const additionalSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Permissions Policy (замена Feature Policy)
  res.setHeader('Permissions-Policy', [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
    'ambient-light-sensor=()',
    'autoplay=(self)',
    'encrypted-media=(self)',
    'fullscreen=(self)',
    'picture-in-picture=(self)',
  ].join(', '));
  
  // Cross-Origin Embedder Policy
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  // Cross-Origin Opener Policy
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  
  // Cross-Origin Resource Policy
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  
  // X-Robots-Tag для API эндпоинтов
  if (req.path.startsWith('/api/')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  }
  
  // Server header
  res.setHeader('Server', 'NewsAggregator/1.0');
  
  // X-Request-ID для трассировки
  if (!res.getHeader('X-Request-ID') && req.headers['x-request-id']) {
    res.setHeader('X-Request-ID', req.headers['x-request-id']);
  }
  
  next();
};

/**
 * Middleware для API эндпоинтов с более строгими правилами
 */
export const apiSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Более строгий CSP для API
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");
  
  // Запрет кэширования для чувствительных API
  if (req.path.includes('/admin/') || req.path.includes('/auth/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  next();
};

/**
 * Middleware для статических файлов
 */
export const staticSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Более мягкий CSP для статических файлов
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  next();
};

/**
 * Middleware для обработки CORS preflight запросов
 */
export const corsSecurityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  const allowedOrigins = process.env.NODE_ENV === 'development' 
    ? [
        'http://localhost:3000',
        'http://localhost:5000',
        'https://localhost:5000'
      ]
    : [process.env.FRONTEND_URL].filter(Boolean);
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Browser-ID',
    'X-Request-ID',
  ].join(', '));
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 часа
  
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  
  next();
};

/**
 * Middleware для защиты от Clickjacking
 */
export const clickjackingProtection = (req: Request, res: Response, next: NextFunction) => {
  // Разрешаем iframe только для собственного домена
  const allowedFrameOrigins = [
    "'self'",
    process.env.FRONTEND_URL,
  ].filter(Boolean);
  
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', 
    `frame-ancestors ${allowedFrameOrigins.join(' ')};`
  );
  
  next();
};

/**
 * Комплексный middleware безопасности
 */
export const comprehensiveSecurityMiddleware = [
  securityHeadersMiddleware,
  additionalSecurityHeaders,
  corsSecurityMiddleware,
  // clickjackingProtection убран - frame-ancestors уже в helmet CSP
];

// Экспорт для использования в разных частях приложения
export const securityMiddlewares = {
  basic: securityHeadersMiddleware,
  additional: additionalSecurityHeaders,
  api: apiSecurityHeaders,
  static: staticSecurityHeaders,
  cors: corsSecurityMiddleware,
  clickjacking: clickjackingProtection,
  comprehensive: comprehensiveSecurityMiddleware,
};