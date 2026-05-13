-- Migration: 0020_analytics_enhancements.sql
-- Add geography, device type, referrer, and duration tracking

ALTER TABLE page_events ADD COLUMN country VARCHAR(2);
ALTER TABLE page_events ADD COLUMN device_type VARCHAR(20);
ALTER TABLE page_events ADD COLUMN referrer_domain VARCHAR(255);
ALTER TABLE page_events ADD COLUMN duration_seconds INTEGER;

CREATE INDEX idx_page_events_country ON page_events(country);
CREATE INDEX idx_page_events_device ON page_events(device_type);
CREATE INDEX idx_page_events_referrer ON page_events(referrer_domain);
