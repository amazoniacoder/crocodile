import React from 'react';
import { useLocation } from 'wouter';

interface YouTubeChannelCardProps {
  channelId: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  region: string;
  category: string;
  url: string;
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

const YT_ICON = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/>
  </svg>
);

export function YouTubeChannelCard({
  channelId,
  name,
  logoUrl,
  region,
  category,
  url,
  onScrollToFeed,
  personal,
}: YouTubeChannelCardProps) {
  const [, navigate] = useLocation();

  return (
    <div className="tg-channel-card yt-channel-card">
      <div className="tg-channel-card__logo-wrap">
        {logoUrl ? (
          <img
            className="tg-channel-card__logo"
            src={logoUrl}
            alt={name}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="tg-channel-card__logo-fallback yt-channel-card__logo-fallback">
            {YT_ICON}
          </div>
        )}
      </div>

      <div className="tg-channel-card__body">
        <div className="tg-channel-card__header">
          <div className="tg-channel-card__title-wrap">
            <span className="tg-channel-card__name">{name}</span>
            <div className="tg-channel-card__name-row">
              <div className="tg-channel-card__meta">
                <span>{REGION_LABEL[region] ?? region}</span>
                <span className="tg-channel-card__dot">·</span>
                <span>{CATEGORY_LABEL[category] ?? category}</span>
              </div>
            </div>
          </div>
          <div className="tg-channel-card__actions">
            <a
              className="yt-channel-card__link"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              На YouTube
            </a>
            {onScrollToFeed && (
              <button
                className="tg-embed__action-btn tg-embed__action-btn--secondary"
                onClick={() => navigate(personal ? '/my/youtube' : '/youtube')}
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
