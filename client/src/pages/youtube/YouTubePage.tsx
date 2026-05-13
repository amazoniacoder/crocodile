import React, { useState, useEffect } from 'react';
import { SocialAggregator } from '@/components/news/SocialAggregator';
import { Icon } from '@/ui-system/icons/components';
import { ContactButton, ContactPanel } from '@/components/contact';

export function YouTubePage() {
  const [pageEnabled, setPageEnabled] = useState<boolean | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    fetch('/api/youtube/status')
      .then(r => r.json())
      .then(d => setPageEnabled(d.enabled))
      .catch(() => setPageEnabled(true));
  }, []);

  if (pageEnabled === false) {
    return (
      <div className="telegram-page">
        <div className="telegram-page__wip">
          <Icon name="wrench" size={48} />
          <h1 className="telegram-page__wip-title">В разработке</h1>
          <p className="telegram-page__wip-text">Раздел временно недоступен. Загляните позже.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="telegram-page" onClick={() => setContactOpen(false)}>
      <SocialAggregator sourceType="youtube" novpnBanner />
      <ContactButton
        onClick={(e) => { e.stopPropagation(); setContactOpen(v => !v); }}
        isOpen={contactOpen}
      />
      <ContactPanel isOpen={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  );
}
