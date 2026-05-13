import React, { createContext, useContext, useEffect, useState } from 'react';

export type DisplaySettingsState = {
  showEmotions: boolean;
};

const DEFAULT_SETTINGS: DisplaySettingsState = { 
  showEmotions: true 
};

const STORAGE_KEY = 'news:display-settings';

type DisplaySettingsContextValue = {
  settings: DisplaySettingsState;
  setSettings: (next: DisplaySettingsState) => void;
  toggleEmotions: () => void;
};

const DisplaySettingsContext = createContext<DisplaySettingsContextValue | null>(null);

export const DisplaySettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettingsState] = useState<DisplaySettingsState>(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<DisplaySettingsState>;
        return {
          showEmotions: parsed.showEmotions ?? DEFAULT_SETTINGS.showEmotions,
        };
      }
    } catch {
      // ignore parse errors
    }
    
    return DEFAULT_SETTINGS;
  });

  const setSettings = (next: DisplaySettingsState) => {
    setSettingsState(next);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  };

  const toggleEmotions = () => {
    setSettings({
      ...settings,
      showEmotions: !settings.showEmotions,
    });
  };

  const value: DisplaySettingsContextValue = { 
    settings, 
    setSettings, 
    toggleEmotions 
  };

  return (
    <DisplaySettingsContext.Provider value={value}>
      {children}
    </DisplaySettingsContext.Provider>
  );
};

export function useDisplaySettings(): DisplaySettingsContextValue {
  const ctx = useContext(DisplaySettingsContext);
  if (!ctx) {
    throw new Error('useDisplaySettings must be used within DisplaySettingsProvider');
  }
  return ctx;
}