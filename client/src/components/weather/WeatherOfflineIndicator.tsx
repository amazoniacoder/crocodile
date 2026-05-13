import React from 'react';

interface Props {
  isOnline: boolean;
  dataSource: 'network' | 'cache' | 'indexeddb';
  serviceWorkerControlsPage?: boolean;
}

const WeatherOfflineIndicator: React.FC<Props> = ({ isOnline, dataSource }) => {
  if (isOnline && dataSource === 'network') return null;

  if (!isOnline) {
    return (
      <div className="offline-banner">
        <span className="offline-banner__icon">📴</span>
        Офлайн — показаны кэшированные данные
      </div>
    );
  }

  if (dataSource === 'cache' || dataSource === 'indexeddb') {
    return (
      <div className="offline-banner offline-banner--info">
        <span className="offline-banner__icon">🔄</span>
        Данные из кэша, обновляем...
      </div>
    );
  }

  return null;
};

export default WeatherOfflineIndicator;
