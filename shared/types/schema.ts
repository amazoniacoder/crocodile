// shared/types/schema.ts
import { pgTable, serial, varchar, text, integer, timestamp, boolean, customType, jsonb, decimal, date, unique, uniqueIndex } from 'drizzle-orm/pg-core';

const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

export const newsSources = pgTable('news_sources', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  url: varchar('url', { length: 500 }).notNull(),
  rssUrl: varchar('rss_url', { length: 500 }).notNull(),
  region: varchar('region', { length: 20 }).notNull().default('russia'),
  category: varchar('category', { length: 50 }).notNull().default('other'),
  city: varchar('city', { length: 100 }),
  sourceType: varchar('source_type', { length: 20 }).notNull().default('rss'),
  isActive: boolean('is_active').default(true),
  isFeatured: boolean('is_featured').default(false),
  isPrivate: boolean('is_private').default(false),
  lastFetchedAt: timestamp('last_fetched_at'),
  description: text('description'),
  logoUrl: text('logo_url'),
  username: varchar('username', { length: 100 }),
  channelId: varchar('channel_id', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow()
});

export const newsClusters = pgTable('news_clusters', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  articleCount: integer('article_count').default(1),
  region: varchar('region', { length: 20 }).notNull().default('russia'),
  category: varchar('category', { length: 50 }).notNull().default('other'),
  firstSeenAt: timestamp('first_seen_at').defaultNow(),
  lastSeenAt: timestamp('last_seen_at').defaultNow()
});

export const newsArticles = pgTable('news_articles', {
  id: serial('id').primaryKey(),
  sourceId: integer('source_id').references(() => newsSources.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  url: text('url').notNull().unique(),
  publishedAt: timestamp('published_at').notNull(),
  fetchedAt: timestamp('fetched_at').defaultNow(),
  region: varchar('region', { length: 20 }).notNull().default('russia'),
  category: varchar('category', { length: 50 }).notNull().default('other'),
  clusterId: integer('cluster_id').references(() => newsClusters.id, { onDelete: 'set null' }),
  isArchived: boolean('is_archived').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  searchVector: tsvector('search_vector'),
  entities: jsonb('entities'),
  likesCount:    integer('likes_count').default(0).notNull(),
  dislikesCount: integer('dislikes_count').default(0).notNull(),
  sourceType: varchar('source_type', { length: 20 }).notNull().default('rss'),
  channelUsername: varchar('channel_username', { length: 100 }),
  messageId: integer('message_id'),
  videoId: varchar('video_id', { length: 20 }),
});

// Статистика каждого цикла сбора по источнику
export const collectionStats = pgTable('collection_stats', {
  id: serial('id').primaryKey(),
  sourceId: integer('source_id').references(() => newsSources.id, { onDelete: 'set null' }),
  collectedAt: timestamp('collected_at').defaultNow().notNull(),
  articlesInserted: integer('articles_inserted').default(0).notNull(),
  articlesDuplicate: integer('articles_duplicate').default(0).notNull(),
  fetchDurationMs: integer('fetch_duration_ms'),   // время запроса к RSS
  avgLatencyMs: integer('avg_latency_ms'),          // среднее fetchedAt-publishedAt, null = аномалия
  errorCount: integer('error_count').default(0).notNull(),
  lastError: text('last_error'),
});

// Лайки и дизлайки на статьях
export const articleReactions = pgTable('article_reactions', {
  id:        serial('id').primaryKey(),
  articleId: integer('article_id').notNull().references(() => newsArticles.id, { onDelete: 'cascade' }),
  type:      varchar('type', { length: 10 }).notNull(),
  dailyHash: varchar('daily_hash', { length: 16 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Эмодзи-реакции (отдельно от лайка/дизлайка): одна на article_id + daily_hash
// Уникальность (article_id, daily_hash) задаётся в SQL-миграции 0008.
export const articleEmotions = pgTable('article_emotions', {
  id:         serial('id').primaryKey(),
  articleId:  integer('article_id').notNull().references(() => newsArticles.id, { onDelete: 'cascade' }),
  emotionId:  varchar('emotion_id', { length: 32 }).notNull(),
  dailyHash:  varchar('daily_hash', { length: 16 }).notNull(),
  createdAt:  timestamp('created_at').defaultNow(),
});

// Анонимная аналитика посещений и кликов
export const pageEvents = pgTable('page_events', {
  id:        serial('id').primaryKey(),
  type:      varchar('type', { length: 20 }).notNull(),       // 'pageview' | 'article_click'
  path:      varchar('path', { length: 500 }),                // '/about', '/russia' и т.д.
  articleId: integer('article_id').references(() => newsArticles.id, { onDelete: 'set null' }),
  dailyHash: varchar('daily_hash', { length: 16 }),           // SHA256(IP+UA+date)[:16] — IP не хранится
  country: varchar('country', { length: 2 }),                 // ISO 3166-1 alpha-2 (через GeoIP, IP не хранится)
  city: varchar('city', { length: 100 }),                     // Город (через GeoIP, IP не хранится)
  deviceType: varchar('device_type', { length: 20 }),         // 'mobile', 'desktop', 'tablet'
  referrerDomain: varchar('referrer_domain', { length: 255 }), // только домен, не полный URL
  durationSeconds: integer('duration_seconds'),               // время на странице в секундах
  createdAt: timestamp('created_at').defaultNow(),
});

// Конфигурация планировщика (интервалы cron и др.)
export const sourceConfig = pgTable('source_config', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Горячие сущности — топ-100 за 24ч, обновляется раз в час
export const hotEntities = pgTable('hot_entities', {
  id:           serial('id').primaryKey(),
  entityText:   varchar('entity_text', { length: 255 }).notNull(),
  entityType:   varchar('entity_type', { length: 10 }).notNull(),
  mentionCount: integer('mention_count').notNull().default(0),
  periodStart:  timestamp('period_start').notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, (t) => [unique().on(t.entityText, t.entityType)]);

// API-ключи для публичного API
export const apiKeys = pgTable('api_keys', {
  id: varchar('id', { length: 36 }).primaryKey(),
  keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  isActive: boolean('is_active').default(true).notNull(),
  requestsPerMinute: integer('requests_per_minute').default(60).notNull(),
  requestsPerDay: integer('requests_per_day').default(10000).notNull(),
});

// Web Push подписки
export const pushSubscriptions = pgTable('push_subscriptions', {
  id:       serial('id').primaryKey(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh:   text('p256dh').notNull(),
  auth:     text('auth').notNull(),
  tokenId:  integer('token_id').references(() => userTokens.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Модуль погоды
export const weatherLocations = pgTable('weather_locations', {
  id:        serial('id').primaryKey(),
  name:      varchar('name', { length: 100 }).notNull(),
  nameEn:    varchar('name_en', { length: 100 }).notNull(),
  country:   varchar('country', { length: 50 }).notNull().default('Russia'),
  latitude:  decimal('latitude', { precision: 8, scale: 5 }).notNull(),
  longitude: decimal('longitude', { precision: 8, scale: 5 }).notNull(),
  timezone:  varchar('timezone', { length: 50 }).notNull().default('Europe/Moscow'),
  isActive:  boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const weatherForecasts = pgTable('weather_forecasts', {
  id:                serial('id').primaryKey(),
  locationId:        integer('location_id').notNull().references(() => weatherLocations.id, { onDelete: 'cascade' }),
  forecastDate:      date('forecast_date').notNull(),
  tempMin:           decimal('temp_min', { precision: 4, scale: 1 }),
  tempMax:           decimal('temp_max', { precision: 4, scale: 1 }),
  precipitationMm:   decimal('precipitation_mm', { precision: 5, scale: 1 }),
  windSpeedKmh:      decimal('wind_speed_kmh', { precision: 5, scale: 1 }),
  windGustsKmh:      decimal('wind_gusts_kmh', { precision: 5, scale: 1 }),
  windDirectionDeg:  integer('wind_direction_deg'),
  humidityPct:       integer('humidity_pct'),
  precipitationProbabilityPct: integer('precipitation_probability_pct'),
  pressureHpa:       decimal('pressure_hpa', { precision: 6, scale: 1 }),
  weatherCode:       integer('weather_code'),
  moonPhase:         decimal('moon_phase', { precision: 4, scale: 3 }),
  moonPhaseName:     varchar('moon_phase_name', { length: 30 }),
  kpIndex:           decimal('kp_index', { precision: 3, scale: 1 }),
  kpLevel:           varchar('kp_level', { length: 20 }),
  uvIndexMax:        decimal('uv_index_max', { precision: 3, scale: 1 }),
  fetchedAt:         timestamp('fetched_at').defaultNow().notNull(),
}, (t) => [uniqueIndex('weather_forecasts_location_date_unique').on(t.locationId, t.forecastDate)]);

export const weatherHourlyForecasts = pgTable('weather_hourly_forecasts', {
  id:           serial('id').primaryKey(),
  locationId:   integer('location_id').notNull().references(() => weatherLocations.id, { onDelete: 'cascade' }),
  forecastDt:   timestamp('forecast_dt', { withTimezone: false }).notNull(), // UTC
  temp:         decimal('temp', { precision: 4, scale: 1 }),
  apparentTemp: decimal('apparent_temp', { precision: 4, scale: 1 }),
  weatherCode:  integer('weather_code'),
  windSpeed:    decimal('wind_speed', { precision: 5, scale: 1 }),
  windGusts:    decimal('wind_gusts', { precision: 5, scale: 1 }),
  windDir:      integer('wind_dir'),
  precipitation: decimal('precipitation', { precision: 5, scale: 1 }),
  pressureHpa:  decimal('pressure_hpa', { precision: 6, scale: 1 }),
  fetchedAt:    timestamp('fetched_at').defaultNow().notNull(),
}, (t) => [uniqueIndex('weather_hourly_location_dt_unique').on(t.locationId, t.forecastDt)]);

// Аудит административных действий
export const adminAuditLog = pgTable('admin_audit_log', {
  id: varchar('id', { length: 36 }).primaryKey(), // UUID
  adminToken: varchar('admin_token', { length: 64 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  resource: varchar('resource', { length: 100 }).notNull(),
  resourceId: varchar('resource_id', { length: 50 }),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(), // IPv6 support
  userAgent: text('user_agent'),
  success: boolean('success').notNull().default(true),
  errorMessage: text('error_message'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Личные кабинеты — токены доступа
export const userTokens = pgTable('user_tokens', {
  id:         serial('id').primaryKey(),
  token:      varchar('token', { length: 67 }).notNull().unique(),
  label:      varchar('label', { length: 255 }),
  isActive:   boolean('is_active').default(true).notNull(),
  isAdmin:    boolean('is_admin').default(false).notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
  expiresAt:  timestamp('expires_at'),
  lastUsedAt: timestamp('last_used_at'),
});

export const userChannelSubscriptions = pgTable('user_channel_subscriptions', {
  id:           serial('id').primaryKey(),
  tokenId:      integer('token_id').notNull().references(() => userTokens.id, { onDelete: 'cascade' }),
  sourceId:     integer('source_id').notNull().references(() => newsSources.id, { onDelete: 'cascade' }),
  subscribedAt: timestamp('subscribed_at').defaultNow().notNull(),
});

export const userBookmarks = pgTable('user_bookmarks', {
  id:        serial('id').primaryKey(),
  tokenId:   integer('token_id').notNull().references(() => userTokens.id, { onDelete: 'cascade' }),
  articleId: integer('article_id').notNull().references(() => newsArticles.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Telegram подписки
export const telegramSubscriptions = pgTable('telegram_subscriptions', {
  id: varchar('id', { length: 36 }).primaryKey(), // UUID
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdBy: varchar('created_by', { length: 100 }).default('admin').notNull(),
});

// Доступ админов к приватным каналам
export const adminChannelAccess = pgTable('admin_channel_access', {
  id: serial('id').primaryKey(),
  tokenId: integer('token_id').notNull().references(() => userTokens.id, { onDelete: 'cascade' }),
  sourceId: integer('source_id').notNull().references(() => newsSources.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
