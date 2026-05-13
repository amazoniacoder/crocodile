import React from 'react';
import { Icon } from '@/ui-system/icons/components';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <Icon name="satellite" size={15} aria-hidden />
      Офлайн — показаны кэшированные данные
    </div>
  );
};

export default OfflineBanner;
