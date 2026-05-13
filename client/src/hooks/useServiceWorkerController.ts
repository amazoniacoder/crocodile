import { useEffect, useState } from 'react';

/**
 * Есть ли активный service worker, управляющий этой страницей (нужно для офлайн-фолбэка /api/weather в SW).
 */
export function useServiceWorkerController(): boolean | undefined {
  const [controlling, setControlling] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      setControlling(false);
      return;
    }

    const sync = () => setControlling(!!navigator.serviceWorker.controller);
    sync();
    navigator.serviceWorker.addEventListener('controllerchange', sync);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', sync);
  }, []);

  return controlling;
}
