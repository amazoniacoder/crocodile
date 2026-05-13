import React, { useEffect, useRef, useState } from 'react';

interface TelegramEmbedProps {
  username: string;
  messageId: number;
  open: boolean;
}

export const TelegramEmbed: React.FC<TelegramEmbedProps> = ({ username, messageId, open }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = '';
    setLoading(true);

    const observer = new MutationObserver(() => {
      if (container.querySelector('iframe')) {
        observer.disconnect();
        setTimeout(() => setLoading(false), 800);
      }
    });
    observer.observe(container, { childList: true, subtree: true });

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-post', `${username}/${messageId}`);
    script.setAttribute('data-width', '100%');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-color', '2CA5E0');
    script.onerror = () => { observer.disconnect(); setLoading(false); };
    container.appendChild(script);

    return () => {
      observer.disconnect();
      container.innerHTML = '';
      setLoading(true);
    };
  }, [open, username, messageId]);

  if (!open) return null;

  return (
    <div className="tg-embed__wrap">
      {loading && (
        <div className="tg-embed__preloader">
          <div className="tg-embed__spin" />
          <span className="tg-embed__spin-label">Загрузка...</span>
        </div>
      )}
      <div className="tg-embed__container" ref={containerRef} />
    </div>
  );
};
