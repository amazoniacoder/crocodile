import React, { useEffect, useState } from 'react';

export const PwaUpdateToast: React.FC = () => {
  const [updateSW, setUpdateSW] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const { updateSW } = (e as CustomEvent).detail;
      setUpdateSW(() => updateSW);
    };
    window.addEventListener('pwa:needRefresh', handler);
    return () => window.removeEventListener('pwa:needRefresh', handler);
  }, []);

  if (!updateSW) return null;

  return (
    <div
      className="pwa-update-toast"
      role="status"
      aria-live="polite"
    >
      <span className="pwa-update-toast__text">Доступна новая версия</span>
      <button
        className="pwa-update-toast__btn"
        onClick={() => updateSW(true)}
        type="button"
      >
        Обновить
      </button>
      <button
        className="pwa-update-toast__dismiss"
        onClick={() => setUpdateSW(null)}
        type="button"
        aria-label="Закрыть"
      >
        ✕
      </button>
    </div>
  );
};
