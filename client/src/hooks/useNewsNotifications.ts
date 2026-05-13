import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useWebSocket } from '@/contexts/websocket-context';
import { ENABLED_REGIONS_EVENT, readEnabledRegionsSnapshot, type EnabledRegionsState } from '@/contexts/enabled-regions-context';
import { useNewsNotificationsStore } from '@/store/newsNotificationsStore';

// Соответствие маршрута региону для сброса счётчика
const ROUTE_TO_REGION: Record<string, 'russia' | 'world' | 'all' | 'social'> = {
  '/russia': 'russia',
  '/world': 'world',
  '/all': 'all',
  '/': 'all',
  '/social': 'social',
};

function routeRegion(path: string): 'russia' | 'world' | 'all' | 'social' | null {
  for (const [prefix, region] of Object.entries(ROUTE_TO_REGION)) {
    if (path === prefix || path.startsWith(prefix + '/')) return region;
  }
  return null;
}

export function useNewsNotifications() {
  const { lastMessage } = useWebSocket();
  const lastMessageRef = useRef<any>(null);
  const knownIdsRef = useRef<Set<number>>(new Set());
  const initializedRef = useRef(false);
  const { add, clear } = useNewsNotificationsStore();
  const [location] = useLocation();
  const prevEnabledRef = useRef<EnabledRegionsState>(readEnabledRegionsSnapshot().enabledRegions);

  // Сбрасываем счётчик при переходе на страницу региона
  useEffect(() => {
    const region = routeRegion(location);
    if (region) clear(region);
  }, [location, clear]);

  // Инициализация — запоминаем текущие ID без уведомлений
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    fetch('/api/news?limit=100')
      .then(r => r.json())
      .then(data => {
        for (const a of data.articles ?? []) knownIdsRef.current.add(a.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const sync = () => {
      const enabled = readEnabledRegionsSnapshot().enabledRegions;
      if (!enabled.russia && prevEnabledRef.current.russia) clear('russia');
      if (!enabled.world && prevEnabledRef.current.world) clear('world');
      prevEnabledRef.current = enabled;
    };

    sync();
    window.addEventListener(ENABLED_REGIONS_EVENT, sync as EventListener);
    return () => window.removeEventListener(ENABLED_REGIONS_EVENT, sync as EventListener);
  }, [clear]);

  // При news_updated — fetch и считаем diff по регионам
  useEffect(() => {
    if (!lastMessage || lastMessage === lastMessageRef.current) return;
    lastMessageRef.current = lastMessage;

    fetch('/api/news?limit=100')
      .then(r => r.json())
      .then(data => {
        const currentRegion = routeRegion(location);
        const enabledRegions = readEnabledRegionsSnapshot().enabledRegions;
        const newByRegion: Record<string, number> = {};

        for (const a of data.articles ?? []) {
          if (!knownIdsRef.current.has(a.id)) {
            knownIdsRef.current.add(a.id);
            const r = a.region as 'russia' | 'world';
            // Не считаем для текущего региона — пользователь уже видит
            if (currentRegion === 'all' || currentRegion === r) continue;
            if (r === 'russia' && !enabledRegions.russia) continue;
            if (r === 'world' && !enabledRegions.world) continue;
            newByRegion[r] = (newByRegion[r] ?? 0) + 1;
          }
        }

        for (const [r, count] of Object.entries(newByRegion)) {
          if (count > 0) add(r as 'russia' | 'world', count);
        }
      })
      .catch(() => {});

    // Считаем новые Telegram-посты отдельно
    if (routeRegion(location) !== 'social') {
      fetch('/api/news?sourceType=telegram&limit=50')
        .then(r => r.json())
        .then(data => {
          let newSocial = 0;
          for (const a of data.articles ?? []) {
            if (!knownIdsRef.current.has(a.id)) {
              knownIdsRef.current.add(a.id);
              newSocial++;
            }
          }
          if (newSocial > 0) add('social', newSocial);
        })
        .catch(() => {});
    }
  }, [lastMessage, location, add]);
}
