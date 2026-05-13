import React from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Индикатор режима ленты: зелёная «лампочка» — онлайн, жёлтая — офлайн.
 * Размещается над лентой, выравнивание слева (см. news-aggregator.css).
 */
export const FeedConnectionIndicator: React.FC = () => {
  const online = useOnlineStatus();

  return (
    <div
      className={`news-feed__connection${online ? ' news-feed__connection--online' : ' news-feed__connection--offline'}`}
      role="status"
      aria-live="polite"
      aria-label={online ? 'Лента: онлайн' : 'Лента: офлайн'}
      title={online ? 'Онлайн — данные загружаются с сервера' : 'Офлайн — сеть недоступна'}
    >
      <span className="news-feed__connection-bulb" aria-hidden />
      <span className="news-feed__connection-label" aria-hidden>
        {online ? 'Онлайн' : 'Офлайн'}
      </span>
    </div>
  );
};
