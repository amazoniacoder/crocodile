import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

// Схемы валидации для API эндпоинтов
export const newsFiltersSchema = Joi.object({
  region: Joi.string().valid('russia', 'world', 'all').default('all'),
  category: Joi.alternatives().try(
    Joi.array().items(Joi.string().valid('economy', 'tech', 'politics', 'society', 'other', 'all')),
    Joi.string().valid('economy', 'tech', 'politics', 'society', 'other', 'all')
  ).optional(),
  city: Joi.string().max(100).optional(),
  date: Joi.string().isoDate().optional(),
  dateFrom: Joi.string().isoDate().optional(),
  dateTo: Joi.string().isoDate().optional(),
  page: Joi.number().integer().min(1).max(1000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  sourceIds: Joi.string().pattern(/^\d+(,\d+)*$/).optional(),
  sourceType: Joi.string().valid('rss', 'telegram', 'youtube').optional(),
  channelUsername: Joi.string().max(100).optional(),
  channelId: Joi.string().max(100).optional(),
  enabledRussia: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.string().valid('0', '1')).optional(),
  enabledWorld: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.string().valid('0', '1')).optional(),
  enabledCities: Joi.alternatives().try(Joi.number().valid(0, 1), Joi.string().valid('0', '1')).optional(),
  tzOffsetMinutes: Joi.number().integer().optional(),
});

export const searchQuerySchema = Joi.object({
  q: Joi.string().min(1).max(200).required(),
  limit: Joi.number().integer().min(1).max(50).default(20),
  offset: Joi.number().integer().min(0).default(0)
});

export const sourceSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  url: Joi.string().uri().required(),
  rssUrl: Joi.string().uri().required(),
  region: Joi.string().valid('russia', 'world').required(),
  category: Joi.string().valid('economy', 'tech', 'politics', 'society', 'other').required(),
  isActive: Joi.boolean().default(true)
});

export const reactionSchema = Joi.object({
  type: Joi.string().valid('like', 'dislike').required()
});

export const emotionSchema = Joi.object({
  emotionId: Joi.string().valid('happy', 'surprised', 'angry', 'sad', 'disgusted').required()
});

export const analyticsEventSchema = Joi.object({
  type: Joi.string().valid('pageview', 'article_click').required(),
  path: Joi.string().max(500).optional(),
  articleId: Joi.number().integer().positive().optional(),
});

export const configUpdateSchema = Joi.object({
  key: Joi.string().valid(
    'fast_interval_cron',
    'slow_interval_cron',
    'telegram_page_enabled',
    'youtube_page_enabled',
    'donate_yoomoney_receiver',
    'donate_yoomoney_label',
    'donate_crypto_btc',
    'donate_crypto_eth',
    'donate_crypto_usdt',
    'donate_methods_json'
  ).required(),
  value: Joi.string().min(1).max(500).required()
});

// Middleware для валидации query параметров
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    req.query = value;
    next();
  };
};

// Middleware для валидации тела запроса
export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    req.body = value;
    next();
  };
};

// Middleware для валидации параметров URL
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    req.params = value;
    next();
  };
};

// Схемы для параметров URL
export const articleIdSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

export const sourceIdSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

// Универсальная функция валидации
export const validate = {
  query: validateQuery,
  body: validateBody,
  params: validateParams
};

// Экспорт всех схем для использования в роутах
export const schemas = {
  newsFilters: newsFiltersSchema,
  searchQuery: searchQuerySchema,
  source: sourceSchema,
  reaction: reactionSchema,
  emotion: emotionSchema,
  analyticsEvent: analyticsEventSchema,
  configUpdate: configUpdateSchema,
  articleId: articleIdSchema,
  sourceId: sourceIdSchema
};