import React from 'react';
import { useLocation } from 'wouter';

interface TelegramChannelCardProps {
  username: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  region: string;
  category: string;
  onScrollToFeed?: () => void;
  personal?: boolean;
}

const REGION_LABEL: Record<string, string> = { russia: 'Россия', world: 'Мир' };
const CATEGORY_LABEL: Record<string, string> = {
  economy: 'Экономика',
  tech: 'Технологии',
  politics: 'Политика',
  society: 'Общество',
  other: 'Другое',
};

export function TelegramChannelCard({
  username,
  name,
  logoUrl,
  region,
  category,
  onScrollToFeed,
  personal,
}: TelegramChannelCardProps) {
  const [, navigate] = useLocation();

  return (
    <div className="tg-channel-card">
      <div className="tg-channel-card__logo-wrap">
        {logoUrl ? (
          <img
            className="tg-channel-card__logo"
            src={logoUrl}
            alt={name}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="tg-channel-card__logo-fallback">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.7 8.02c-.12.56-.46.7-.93.43l-2.57-1.89-1.24 1.19c-.14.14-.25.25-.51.25l.18-2.6 4.72-4.26c.2-.18-.05-.28-.32-.1L7.4 14.53l-2.52-.79c-.55-.17-.56-.55.12-.81l9.85-3.8c.46-.17.86.11.79.67z"/>
            </svg>
          </div>
        )}
      </div>

      <div className="tg-channel-card__body">
        <div className="tg-channel-card__header">
          <div className="tg-channel-card__title-wrap">
            <span className="tg-channel-card__name">{name}</span>
            <div className="tg-channel-card__name-row">
              <span className="tg-channel-card__username">@{username}</span>
              <div className="tg-channel-card__meta">
                <span>{REGION_LABEL[region] ?? region}</span>
                <span className="tg-channel-card__dot">·</span>
                <span>{CATEGORY_LABEL[category] ?? category}</span>
              </div>
            </div>
          </div>
          <div className="tg-channel-card__actions">
            <a
              className="tg-channel-card__link"
              href={`https://t.me/${username}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              В Telegram
            </a>
            {onScrollToFeed && (
              <button
                className="tg-embed__action-btn tg-embed__action-btn--secondary"
                onClick={() => navigate(personal ? '/my/telegram' : '/social')}
              >
                ← К ленте
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
