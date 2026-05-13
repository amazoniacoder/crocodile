/**
 * BlogPro Icon Component
 * Centralized SVG icon system with TypeScript support
 */

import React from 'react';

export type IconName = 
  // Navigation
  | 'arrow-up'
  | 'arrow-down'
  | 'arrow-left'
  | 'arrow-right'
  | 'house'
  | 'hamburger'
  | 'search'
  | 'grid'
  | 'table'
  // Actions
  | 'save'
  | 'edit'
  | 'delete'
  | 'add'
  | 'minus'
  | 'refresh'
  | 'login'
  | 'logout'
  | 'alert-circle'
  | 'x'
  | 'check'
  | 'circle'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'eye'
  | 'eye-off'
  | 'calendar'
  | 'share'
  | 'heart'
  | 'reply'
  | 'thumbs-up'
  | 'flag'
  | 'download'
  | 'upload'
  | 'clock'
  | 'bell'
  | 'puzzle'
  | 'shopping-cart'
  | 'credit-card'
  | 'wallet'
  | 'paypal'
  | 'email'
  | 'camera'
  | 'status'
  | 'lock'
  | 'key'
  | 'star'
  // Users
  | 'user'
  | 'users'
  | 'admin'
  // Content
  | 'image'
  | 'book'
  | 'folder'
  | 'video'
  | 'audio'
  | 'file'
  | 'file-search'
  | 'file-users'
  | 'file-crown'
  // Themes
  | 'sun'
  | 'moon'
  | 'cake-icing'
  | 'palette'
  | 'smile-diamond'
  // Tools
  | 'gear'
  | 'wrench'
  | 'phone'
  | 'mobile'
  // Analytics
  | 'monkey-running'
  | 'rocket-diamond'
  | 'tree-diamond'
  | 'chart'
  // Footer Editor
  | 'layout'
  | 'history'
  | 'loader'
  | 'move'
  | 'resize'
  // Social Media
  | 'facebook'
  | 'twitter'
  | 'instagram'
  | 'linkedin'
  | 'youtube'
  | 'telegram'
  | 'settings'
  | 'smartphone'
  | 'monitor'
  | 'tablet'
  // New icons
  | 'satellite'
  | 'sliders'
  | 'fire'
  | 'flask'
  | 'shield'
  | 'server'
  | 'trending-up'
  | 'thumbs-down'
  | 'person'
  | 'location'
  | 'building'
  | 'trophy'
  | 'list'
  | 'cloud'
  | 'cloud-rain'
  | 'cloud-snow'
  | 'cloud-lightning'
  | 'cloud-drizzle'
  | 'wind'

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'name' | 'size' | 'color' | 'onClick'> {
  name: IconName;
  size?: number | string;
  color?: string;
  className?: string;
  'aria-label'?: string;
  onClick?: () => void;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = 'currentColor',
  className = '',
  'aria-label': ariaLabel,
  onClick,
  ...props
}) => {
  // Direct SVG paths for critical icons only
  const iconPaths: Partial<Record<IconName, string>> = {
    'search': 'M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0M21 21l-4.35-4.35',
    'x': 'M18 6L6 18M6 6l12 12',
    'hamburger': 'M3 6h18M3 12h18M3 18h18',
    'user': 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'admin': 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
    'login': 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3',
    'logout': 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    'reply': 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
    'arrow-left': 'M19 12H5M12 19l-7-7 7-7',
    'sun': 'M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
    'moon': 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
    'gear': 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z',
    'phone': 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
    'mobile': 'M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 18h.01',
    'settings': 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z',
    'smartphone': 'M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 18h.01',
    'monitor': 'M2 3h20v14H2zM8 21h8M12 17v4',
    'lock': 'M5 11V7a7 7 0 0 1 14 0v4M3 11h18a2 2 0 0 1 2 2v7a2 2 0 0 0-2 2H3a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM12 16v2',
    'satellite': 'M4.5 16.5L2 22l5.5-2.5M16.5 4.5L22 2l-2.5 5.5M8 16l-1.5 1.5M16 8l1.5-1.5M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M6.34 17.66a8 8 0 0 1 0-11.32M17.66 6.34a8 8 0 0 1 0 11.32',
    'sliders': 'M4 21V14M4 10V3M12 21V12M12 8V3M20 21V16M20 12V3M1 14h6M9 8h6M17 16h6',
    'fire': 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
    'flask': 'M9 3h6M10 3v7l-4 8a1 1 0 0 0 .9 1.5h10.2a1 1 0 0 0 .9-1.5l-4-8V3M8.5 15h7',
    'shield': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'server': 'M2 2h20v8H2zM2 14h20v8H2zM6 6h.01M6 18h.01',
    'trending-up': 'M23 6L13.5 15.5 8.5 10.5 1 18M17 6h6v6',
    'thumbs-down': 'M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17',
    'person': 'M12 8m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M4 20c0-4 3.6-7 8-7s8 3 8 7',
    'location': 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
    'building': 'M3 3h18v18H3zM3 9h18M9 21V9',
    'trophy': 'M6 9H3V4h3M18 9h3V4h-3M8 21h8M12 17v4M7 4h10v8a5 5 0 0 1-10 0V4zM5 8c-1.5 0-2-1-2-2s.5-2 2-2M19 8c1.5 0 2-1 2-2s-.5-2-2-2',
    'list': 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    'loader': 'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83',
    'cloud': 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z',
    'cloud-rain': 'M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25',
    'cloud-snow': 'M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25M8 16h.01M8 20h.01M12 18h.01M12 22h.01M16 16h.01M16 20h.01',
    'cloud-lightning': 'M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9M13 11l-4 6h6l-4 6',
    'cloud-drizzle': 'M8 19v2M8 13v2M16 19v2M16 13v2M12 21v2M12 15v2M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25',
    'wind': 'M9.59 4.59A2 2 0 1 1 11 8H2M12.59 19.41A2 2 0 1 0 14 16H2M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2',
  };

  const pathData = iconPaths[name];
  
  if (!pathData) {
    const baseUrl = import.meta.env.DEV ? '' : '';
    return (
      <svg
        className={`icon icon--${name} ${className}`}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label={ariaLabel || name}
        role="img"
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : 'inherit' }}
        {...props}
      >
        <use href={`${baseUrl}/icons/sprite.svg#icon-${name}`} />
      </svg>
    );
  }

  return (
    <svg
      className={`icon icon--${name} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={ariaLabel || name}
      role="img"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'inherit' }}
      {...props}
    >
      <path d={pathData} />
    </svg>
  );
};

export default Icon;
