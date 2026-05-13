const ENDPOINT = '/api/events';
const CLICKED_KEY = 'analytics:clicked';

let pageStartTime = Date.now();

const getClicked = (): Set<number> => {
  try {
    const raw = sessionStorage.getItem(CLICKED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const markClicked = (id: number) => {
  try {
    const set = getClicked();
    set.add(id);
    sessionStorage.setItem(CLICKED_KEY, JSON.stringify([...set]));
  } catch {}
};

const send = (body: object) => {
  try {
    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
    navigator.sendBeacon(ENDPOINT, blob);
  } catch {}
};

export const analytics = {
  pageview(path: string) {
    pageStartTime = Date.now();
    send({ type: 'pageview', path });
  },
  
  articleClick(articleId: number) {
    if (getClicked().has(articleId)) return;
    markClicked(articleId);
    send({ type: 'article_click', articleId });
  },
  
  pageLeave(path: string) {
    const duration = Math.floor((Date.now() - pageStartTime) / 1000);
    if (duration > 2) {
      send({ type: 'pageview', path, duration });
    }
  },
};

// Трекинг ухода со страницы
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const path = window.location.pathname;
    analytics.pageLeave(path);
  });
}
