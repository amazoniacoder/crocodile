const KEY = 'reactions:v1';
const BROWSER_ID_KEY = 'reactions:browser-id';

const getBrowserId = (): string => {
  try {
    let id = localStorage.getItem(BROWSER_ID_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      localStorage.setItem(BROWSER_ID_KEY, id);
    }
    return id;
  } catch {
    return 'unknown';
  }
};

export { getBrowserId };

type ArticleReaction = {
  like?: true;
  dislike?: true;
  emotion?: string;
};

type Store = Record<number, ArticleReaction>;

const load = (): Store => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const save = (store: Store) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {}
};

export const reactionsStore = {
  get(articleId: number): ArticleReaction {
    return load()[articleId] ?? {};
  },

  hasLiked(articleId: number): boolean {
    return !!load()[articleId]?.like;
  },

  hasDisliked(articleId: number): boolean {
    return !!load()[articleId]?.dislike;
  },

  getEmotion(articleId: number): string | null {
    return load()[articleId]?.emotion ?? null;
  },

  setLike(articleId: number): void {
    const store = load();
    store[articleId] = { ...store[articleId], like: true, dislike: undefined };
    save(store);
  },

  setDislike(articleId: number): void {
    const store = load();
    store[articleId] = { ...store[articleId], dislike: true, like: undefined };
    save(store);
  },

  removeLike(articleId: number): void {
    const store = load();
    if (store[articleId]) {
      delete store[articleId].like;
      save(store);
    }
  },

  removeDislike(articleId: number): void {
    const store = load();
    if (store[articleId]) {
      delete store[articleId].dislike;
      save(store);
    }
  },

  /** Старые смайлы из localStorage; после переноса в БД — очистить. */
  clearEmotion(articleId: number): void {
    const store = load();
    if (store[articleId]?.emotion != null) {
      delete store[articleId].emotion;
      save(store);
    }
  },
};
