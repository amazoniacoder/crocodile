import { create } from 'zustand';
import type { NewsRegion } from '@newsaggregator/shared/types/news';

type RegionFilter = NewsRegion | 'all';

interface NewsRegionStore {
  region: RegionFilter;
  setRegion: (r: RegionFilter) => void;
}

export const useNewsRegionStore = create<NewsRegionStore>((set) => ({
  region: 'all',
  setRegion: (region) => set({ region }),
}));
