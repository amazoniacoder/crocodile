import DOMPurify from 'isomorphic-dompurify';
import { Request, Response, NextFunction } from 'express';

/**
 * Санитизация HTML контента
 */
export const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'i', 'b'],
    ALLOWED_ATTR: []
  });
};

/**
 * Санитизация поисковых запросов
 */
export const sanitizeSearchQuery = (query: string): string => {
  return query
    .replace(/[<>"'`]/g, '') // Удаляем потенциально опасные символы
    .replace(/\s+/g, ' ') // Заменяем множественные пробелы на одинарные
    .substring(0, 200) // Ограничиваем длину
    .trim();
};

/**
 * Санитизация SQL-подобных паттернов
 */
export const sanitizeSqlInput = (input: string): string => {
  return input
    .replace(/[';\-\-]/g, '') // Удаляем SQL комментарии и точки с запятой
    .replace(/\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b/gi, '') // Удаляем SQL ключевые слова
    .trim();
};

/**
 * Санитизация имен файлов
 */
export const sanitizeFileName = (filename: string): string => {
  return filename
    .replace(/[^a-zA-Z0-9._\-]/g, '') // Только безопасные символы
    .replace(/\.{2,}/g, '.') // Предотвращаем path traversal
    .substring(0, 100); // Ограничиваем длину
};

/**
 * Санитизация URL
 */
export const sanitizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    // Разрешаем только HTTP и HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
    return parsed.toString();
  } catch {
    return '';
  }
};

/**
 * Рекурсивная санитизация объекта
 */
const sanitizeObject = (obj: any, depth = 0): any => {
  // Предотвращаем слишком глубокую рекурсию
  if (depth > 10) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeSqlInput(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Санитизируем ключи объекта
      const cleanKey = sanitizeSqlInput(key);
      sanitized[cleanKey] = sanitizeObject(value, depth + 1);
    }
    return sanitized;
  }
  
  return obj;
};

/**
 * Middleware для санитизации всех входящих данных
 */
export const sanitizationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Санитизируем query параметры
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    // Санитизируем тело запроса
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    // Санитизируем параметры URL
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    
    // Специальная обработка для поисковых запросов
    if (req.query.q && typeof req.query.q === 'string') {
      req.query.q = sanitizeSearchQuery(req.query.q);
    }
    
    // Специальная обработка для HTML контента
    if (req.body.content && typeof req.body.content === 'string') {
      req.body.content = sanitizeHtml(req.body.content);
    }
    
    if (req.body.description && typeof req.body.description === 'string') {
      req.body.description = sanitizeHtml(req.body.description);
    }
    
    // Специальная обработка для URL
    if (req.body.url && typeof req.body.url === 'string') {
      req.body.url = sanitizeUrl(req.body.url);
    }
    
    if (req.body.rssUrl && typeof req.body.rssUrl === 'string') {
      req.body.rssUrl = sanitizeUrl(req.body.rssUrl);
    }
    
    next();
  } catch (error) {
    console.error('Sanitization error:', error);
    res.status(400).json({
      success: false,
      error: 'Invalid input data'
    });
  }
};

/**
 * Middleware для дополнительной защиты от XSS в заголовках
 */
export const xssProtectionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Санитизируем потенциально опасные заголовки
  const dangerousHeaders = ['user-agent', 'referer', 'origin'];
  
  dangerousHeaders.forEach(header => {
    if (req.headers[header] && typeof req.headers[header] === 'string') {
      req.headers[header] = sanitizeSqlInput(req.headers[header] as string);
    }
  });
  
  next();
};

// Экспорт для использования в других модулях
export const sanitizers = {
  html: sanitizeHtml,
  searchQuery: sanitizeSearchQuery,
  sqlInput: sanitizeSqlInput,
  fileName: sanitizeFileName,
  url: sanitizeUrl,
  object: sanitizeObject
};