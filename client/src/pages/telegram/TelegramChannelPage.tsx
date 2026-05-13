import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { SocialAggregator } from '@/components/news/SocialAggregator';
import { TelegramChannelCard } from '@/components/news/TelegramChannelCard';
import { ContactButton, ContactPanel } from '@/components/contact';

interface TelegramChannelPageProps {
  params: { username: string };
  personal?: boolean;
}

interface ChannelInfo {
  username: string;
  name: string;
  region: string;
  category: string;
  description: string | null;
  logoUrl: string | null;
}

const TG_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.7 8.02c-.12.56-.46.7-.93.43l-2.57-1.89-1.24 1.19c-.14.14-.25.25-.51.25l.18-2.6 4.72-4.26c.2-.18-.05-.28-.32-.1L7.4 14.53l-2.52-.79c-.55-.17-.56-.55.12-.81l9.85-3.8c.46-.17.86.11.79.67z"/>
  </svg>
);

const YT_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/>
  </svg>
);

export function TelegramChannelPage({ params, personal }: TelegramChannelPageProps) {
  const [, navigate] = useLocation();
  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/telegram/channel/${params.username}`)
      .then(r => r.json())
      .then(d => setChannel(d.channel))
      .catch(() => {});
  }, [params.username]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scrollTo = params.get('scrollTo');
    if (scrollTo) {
      const timer = setTimeout(() => {
        const card = document.querySelector(`[data-article-id="${scrollTo}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('news-card--highlight-scroll');
          setTimeout(() => card.classList.remove('news-card--highlight-scroll'), 2000);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const scrollToFeed = () => {
    const feedEl = document.querySelector('.news-aggregator__feed');
    if (feedEl) feedEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="telegram-channel-page" onClick={() => setContactOpen(false)}>
      <div className="social-novpn-bar">
        <div className="social-novpn-bar__inner">
          <button
            className="news-pagination__btn social-novpn-bar__btn social-novpn-bar__btn--active"
            onClick={() => navigate(personal ? '/my' : '/social')}
            aria-label="Telegram"
          >
            {TG_ICON}
          </button>
          <div className="social-novpn-bar__info">
            <span className="social-novpn-bar__badge">{personal ? 'Моя лента' : 'VPN-free'}</span>
            {personal ? 'Персональная лента из выбранных каналов' : 'Читайте Telegram без VPN — посты собираются нашим сервером'}
          </div>
          <button
            className="news-pagination__btn social-novpn-bar__btn social-novpn-bar__btn--yt"
            onClick={() => navigate(personal ? '/my' : '/youtube')}
            aria-label="YouTube"
          >
            {YT_ICON}
          </button>
        </div>
      </div>
      {channel && (
        <div className="tg-channel-card-container">
          <TelegramChannelCard
            username={channel.username}
            name={channel.name}
            description={channel.description}
            logoUrl={channel.logoUrl}
            region={channel.region}
            category={channel.category}
            onScrollToFeed={scrollToFeed}
            personal={personal}
          />
        </div>
      )}
      <SocialAggregator channelUsername={params.username} />
      <ContactButton
        onClick={(e) => { e.stopPropagation(); setContactOpen(v => !v); }}
        isOpen={contactOpen}
      />
      <ContactPanel isOpen={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  );
}
