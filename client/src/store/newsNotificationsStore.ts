import { create } from 'zustand';

// Ключи: 'russia' | 'world' | 'all' | 'social'
// 'all' = сумма russia + world (для страницы /all)
interface NewsNotificationsStore {
  counts: Record<string, number>;
  add: (region: 'russia' | 'world' | 'social', count: number) => void;
  clear: (region: 'russia' | 'world' | 'all' | 'social') => void;
}

export const useNewsNotificationsStore = create<NewsNotificationsStore>((set) => ({
  counts: {},
  add: (region, count) => set((state) => {
    const next: Record<string, number> = { ...state.counts, [region]: (state.counts[region] ?? 0) + count };
    if (region !== 'social') next['all'] = (state.counts['all'] ?? 0) + count;
    return { counts: next };
  }),
  clear: (region) => set((state) => {
    const next = { ...state.counts };
    if (region === 'all') {
      delete next['russia'];
      delete next['world'];
      delete next['all'];
    } else {
      const cleared = next[region] ?? 0;
      delete next[region];
      if (region !== 'social') {
        next['all'] = Math.max(0, (next['all'] ?? 0) - cleared);
        if (next['all'] === 0) delete next['all'];
      }
    }
    return { counts: next };
  }),
}));
