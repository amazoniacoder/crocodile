import { useState, useEffect, useCallback } from 'react';
import {
  subscribeToPush,
  unsubscribeFromPush,
  getPushSubscriptionState,
} from '@/services/push-service';

type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading';

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('loading');

  useEffect(() => {
    getPushSubscriptionState().then(setState);
  }, []);

  const subscribe = useCallback(async () => {
    setState('loading');
    const ok = await subscribeToPush();
    setState(ok ? 'subscribed' : (Notification.permission === 'denied' ? 'denied' : 'unsubscribed'));
  }, []);

  const unsubscribe = useCallback(async () => {
    setState('loading');
    await unsubscribeFromPush();
    setState('unsubscribed');
  }, []);

  return { state, subscribe, unsubscribe };
}
