-- Migration: Telegram Integration
-- Adds support for Telegram channels as separate content source with subscription tokens

-- 1. Extend news_sources with source_type
ALTER TABLE news_sources 
ADD COLUMN source_type VARCHAR(20) DEFAULT 'rss' CHECK (source_type IN ('rss', 'telegram'));

UPDATE news_sources SET source_type = 'rss' WHERE source_type IS NULL;

CREATE INDEX idx_news_sources_type ON news_sources(source_type);

-- 2. Create telegram_subscriptions table
CREATE TABLE telegram_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(100) DEFAULT 'admin'
);

CREATE INDEX idx_telegram_subscriptions_active ON telegram_subscriptions(is_active, expires_at);

-- 3. Extend news_articles with Telegram fields
ALTER TABLE news_articles 
ADD COLUMN source_type VARCHAR(20) DEFAULT 'rss' CHECK (source_type IN ('rss', 'telegram')),
ADD COLUMN channel_username VARCHAR(100),
ADD COLUMN message_id BIGINT;

UPDATE news_articles SET source_type = 'rss' WHERE source_type IS NULL;

CREATE INDEX idx_news_articles_source_type ON news_articles(source_type);
CREATE INDEX idx_news_articles_telegram ON news_articles(channel_username, message_id) WHERE source_type = 'telegram';
