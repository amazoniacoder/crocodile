import { useState, useCallback } from 'react';

interface ShareOptions {
  title: string;
  url: string;
}

type ShareStatus = 'idle' | 'copied';

const isMobile = (): boolean => {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

export function useShare(): { share: (opts: ShareOptions) => Promise<void>; status: ShareStatus } {
  const [status, setStatus] = useState<ShareStatus>('idle');

  const share = useCallback(async ({ title, url }: ShareOptions) => {
    // Web Share API только на мобильных
    if (isMobile() && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // пользователь отменил
        return;
      }
    }
    // Десктоп: копируем в буфер
    try {
      await navigator.clipboard.writeText(url);
      setStatus('copied');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      // clipboard недоступен
    }
  }, []);

  return { share, status };
}
