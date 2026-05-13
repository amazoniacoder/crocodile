-- Migration: Add username and channel_id to news_sources
-- Created: 2025-01-XX

ALTER TABLE news_sources
ADD COLUMN IF NOT EXISTS username VARCHAR(100),
ADD COLUMN IF NOT EXISTS channel_id VARCHAR(100);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_news_sources_username ON news_sources(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_news_sources_channel_id ON news_sources(channel_id) WHERE channel_id IS NOT NULL;

-- Update existing Telegram channels with username from URL
-- Example: https://t.me/vedomosti -> username = 'vedomosti'
UPDATE news_sources
SET username = SUBSTRING(url FROM 'https://t\.me/([^/]+)')
WHERE source_type = 'telegram' AND username IS NULL AND url LIKE 'https://t.me/%';

-- Update existing YouTube channels with channelId from rss_url
-- Example: https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxx -> channel_id = 'UCxxxx'
UPDATE news_sources
SET channel_id = SUBSTRING(rss_url FROM 'channel_id=([^&]+)')
WHERE source_type = 'youtube' AND channel_id IS NULL AND rss_url LIKE '%channel_id=%';
