// client/src/utils/theme-colors.ts
export interface ThemeColor {
  id: string;
  name: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryRgb: string;
}

export const themeColors: ThemeColor[] = [
  {
    id: 'blue',
    name: 'Синий',
    primary: '#3b82f6',
    primaryDark: '#2563eb',
    primaryLight: '#60a5fa',
    primaryRgb: '59, 130, 246'
  },
  {
    id: 'red',
    name: 'Красный',
    primary: '#ef4444',
    primaryDark: '#dc2626',
    primaryLight: '#f87171',
    primaryRgb: '239, 68, 68'
  },
  {
    id: 'orange',
    name: 'Оранжевый',
    primary: '#f97316',
    primaryDark: '#ea580c',
    primaryLight: '#fb923c',
    primaryRgb: '249, 115, 22'
  },
  {
    id: 'green',
    name: 'Зеленый',
    primary: '#10b981',
    primaryDark: '#059669',
    primaryLight: '#34d399',
    primaryRgb: '16, 185, 129'
  },
  {
    id: 'purple',
    name: 'Фиолетовый',
    primary: '#8b5cf6',
    primaryDark: '#7c3aed',
    primaryLight: '#a78bfa',
    primaryRgb: '139, 92, 246'
  },
  {
    id: 'lightblue',
    name: 'Голубой',
    primary: '#06b6d4',
    primaryDark: '#0891b2',
    primaryLight: '#22d3ee',
    primaryRgb: '6, 182, 212'
  },
  {
    id: 'black',
    name: 'Черный',
    primary: '#374151',
    primaryDark: '#1f2937',
    primaryLight: '#6b7280',
    primaryRgb: '55, 65, 81'
  },
  {
    id: 'rainbow',
    name: 'Радуга',
    primary: 'linear-gradient(45deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080)',
    primaryDark: 'linear-gradient(45deg, #cc0000, #cc6600, #cccc00, #66cc00, #00cc00, #00cc66, #00cccc, #0066cc, #0000cc, #6600cc, #cc00cc, #cc0066)',
    primaryLight: 'linear-gradient(45deg, #ff3333, #ff9933, #ffff33, #99ff33, #33ff33, #33ff99, #33ffff, #3399ff, #3333ff, #9933ff, #ff33ff, #ff3399)',
    primaryRgb: '255, 0, 128'
  }
];

export const applyColorTheme = (colorId: string): void => {
  const color = themeColors.find(c => c.id === colorId);
  if (!color) return;

  const root = document.documentElement;
  
  if (colorId === 'rainbow') {
    root.style.setProperty('--color-primary', color.primary);
    root.style.setProperty('--color-primary-dark', color.primaryDark);
    root.style.setProperty('--color-primary-light', color.primaryLight);
    root.style.setProperty('--color-primary-bg', `rgba(${color.primaryRgb}, 0.1)`);
    root.classList.add('rainbow-theme');
  } else {
    root.style.setProperty('--color-primary', color.primary);
    root.style.setProperty('--color-primary-dark', color.primaryDark);
    root.style.setProperty('--color-primary-light', color.primaryLight);
    root.style.setProperty('--color-primary-bg', `rgba(${color.primaryRgb}, 0.1)`);
    root.style.setProperty('--color-primary-rgb', color.primaryRgb);
    root.classList.remove('rainbow-theme');
  }
};

export const getStoredColorTheme = (): string => {
  return localStorage.getItem('colorTheme') || 'blue';
};

export const setStoredColorTheme = (colorId: string): void => {
  localStorage.setItem('colorTheme', colorId);
};
