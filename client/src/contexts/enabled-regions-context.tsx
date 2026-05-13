import React, { createContext, useContext, useEffect, useState } from 'react';

export type EnabledRegionsState = {
  russia: boolean;
  world: boolean;
  cities: boolean;
};

export type DisabledSinceState = {
  russia: number | null;
  world: number | null;
  cities: number | null;
};

export type EnabledRegionsSnapshot = {
  enabledRegions: EnabledRegionsState;
  disabledSince: DisabledSinceState;
};

const DEFAULT_ENABLED: EnabledRegionsState = { russia: true, world: true, cities: true };
const DEFAULT_DISABLED_SINCE: DisabledSinceState = { russia: null, world: null, cities: null };

export const ENABLED_REGIONS_EVENT = 'news-enabled-regions-changed';

declare global {
  interface Window {
    __newsEnabledRegionsSnapshot?: EnabledRegionsSnapshot;
  }
}

export function readEnabledRegionsSnapshot(): EnabledRegionsSnapshot {
  if (typeof window === 'undefined') {
    return { enabledRegions: DEFAULT_ENABLED, disabledSince: DEFAULT_DISABLED_SINCE };
  }
  return window.__newsEnabledRegionsSnapshot ?? { enabledRegions: DEFAULT_ENABLED, disabledSince: DEFAULT_DISABLED_SINCE };
}

type EnabledRegionsContextValue = {
  enabledRegions: EnabledRegionsState;
  disabledSince: DisabledSinceState;
  setEnabledRegions: (next: EnabledRegionsState) => void;
};

const EnabledRegionsContext = createContext<EnabledRegionsContextValue | null>(null);

export const EnabledRegionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [enabledRegions, setEnabledRegionsState] = useState<EnabledRegionsState>(DEFAULT_ENABLED);
  const [disabledSince, setDisabledSince] = useState<DisabledSinceState>(DEFAULT_DISABLED_SINCE);

  const setEnabledRegions = (next: EnabledRegionsState) => {
    const now = Date.now();
    setEnabledRegionsState(next);
    setDisabledSince((prev) => ({
      russia: !next.russia ? (prev.russia ?? now) : null,
      world: !next.world ? (prev.world ?? now) : null,
      cities: !next.cities ? (prev.cities ?? now) : null,
    }));
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const snapshot: EnabledRegionsSnapshot = { enabledRegions, disabledSince };
    window.__newsEnabledRegionsSnapshot = snapshot;
    window.dispatchEvent(new CustomEvent(ENABLED_REGIONS_EVENT, { detail: snapshot }));
  }, [enabledRegions, disabledSince]);

  const value: EnabledRegionsContextValue = { enabledRegions, disabledSince, setEnabledRegions };

  return (
    <EnabledRegionsContext.Provider value={value}>
      {children}
    </EnabledRegionsContext.Provider>
  );
};

export function useEnabledRegions(): EnabledRegionsContextValue {
  const ctx = useContext(EnabledRegionsContext);
  if (!ctx) {
    throw new Error('useEnabledRegions must be used within EnabledRegionsProvider');
  }
  return ctx;
}
