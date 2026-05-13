/**
 * BlogPro Icon Sprite Loader
 * Loads the icon sprite into the DOM for use with <use> references
 */

import React, { useEffect } from 'react';

const SPRITE_ID = 'icon-sprite';

export const SpriteLoader: React.FC = () => {
  useEffect(() => {
    // Check if sprite is already loaded
    if (document.getElementById(SPRITE_ID)) {
      return;
    }

    // Create and inject sprite
    const spriteContainer = document.createElement('div');
    spriteContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" style="display: none;" id="${SPRITE_ID}">
  <symbol id="icon-add" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"></circle>
  <line x1="12" y1="8" x2="12" y2="16"></line>
  <line x1="8" y1="12" x2="16" y2="12"></line>
  </symbol>
  <symbol id="icon-alert-circle" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"></circle>
  <line x1="12" y1="8" x2="12" y2="12"></line>
  <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </symbol>
  <symbol id="icon-bell" viewBox="0 0 24 24">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </symbol>
  <symbol id="icon-calendar" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
  <line x1="16" y1="2" x2="16" y2="6"></line>
  <line x1="8" y1="2" x2="8" y2="6"></line>
  <line x1="3" y1="10" x2="21" y2="10"></line>
  </symbol>
  <symbol id="icon-check" viewBox="0 0 24 24">
    <polyline points="20 6 9 17 4 12"></polyline>
  </symbol>
  <symbol id="icon-circle" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"></circle>
  </symbol>
  <symbol id="icon-clock" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"></circle>
  <polyline points="12 6 12 12 16 14"></polyline>
  </symbol>
  <symbol id="icon-delete" viewBox="0 0 24 24">
    <polyline points="3,6 5,6 21,6"></polyline>
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  <line x1="10" y1="11" x2="10" y2="17"></line>
  <line x1="14" y1="11" x2="14" y2="17"></line>
  </symbol>
  <symbol id="icon-download" viewBox="0 0 24 24">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
  <polyline points="7 10 12 15 17 10"></polyline>
  <line x1="12" y1="15" x2="12" y2="3"></line>
  </symbol>
  <symbol id="icon-edit" viewBox="0 0 24 24">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </symbol>
  <symbol id="icon-error" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"></circle>
  <line x1="15" y1="9" x2="9" y2="15"></line>
  <line x1="9" y1="9" x2="15" y2="15"></line>
  </symbol>
  <symbol id="icon-eye-off" viewBox="0 0 24 24">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
  <line x1="1" y1="1" x2="23" y2="23"></line>
  </symbol>
  <symbol id="icon-eye" viewBox="0 0 24 24">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
  <circle cx="12" cy="12" r="3"></circle>
  </symbol>
  <symbol id="icon-heart" viewBox="0 0 24 24">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </symbol>
  <symbol id="icon-info" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"></circle>
  <line x1="12" y1="16" x2="12" y2="12"></line>
  <line x1="12" y1="8" x2="12.01" y2="8"></line>
  </symbol>
  <symbol id="icon-login" viewBox="0 0 24 24">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
  <polyline points="10 17 15 12 10 7"></polyline>
  <line x1="15" y1="12" x2="3" y2="12"></line>
  </symbol>
  <symbol id="icon-logout" viewBox="0 0 24 24">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
  <polyline points="16 17 21 12 16 7"></polyline>
  <line x1="21" y1="12" x2="9" y2="12"></line>
  </symbol>
  <symbol id="icon-minus" viewBox="0 0 24 24">
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </symbol>
  <symbol id="icon-refresh" viewBox="0 0 24 24">
    <path d="M3 2v6h6"></path>
  <path d="M21 12A9 9 0 0 0 6 5.3L3 8"></path>
  <path d="M21 22v-6h-6"></path>
  <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"></path>
  </symbol>
  <symbol id="icon-save" viewBox="0 0 24 24">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
  <polyline points="17,21 17,13 7,13 7,21"></polyline>
  <polyline points="7,3 7,8 15,8"></polyline>
  </symbol>
  <symbol id="icon-share" viewBox="0 0 24 24">
    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
  </symbol>
  <symbol id="icon-success" viewBox="0 0 24 24">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
  <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </symbol>
  <symbol id="icon-upload" viewBox="0 0 24 24">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
  <polyline points="17 8 12 3 7 8"></polyline>
  <line x1="12" y1="3" x2="12" y2="15"></line>
  </symbol>
  <symbol id="icon-warning" viewBox="0 0 24 24">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
  <line x1="12" y1="9" x2="12" y2="13"></line>
  <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </symbol>
  <symbol id="icon-x" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18"></line>
  <line x1="6" y1="6" x2="18" y2="18"></line>
  </symbol>
  <symbol id="icon-chart" viewBox="0 0 24 24">
    <path d="M3 3v18h18"></path>
  <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
  </symbol>
  <symbol id="icon-arrow-down" viewBox="0 0 24 24">
    <line x1="12" y1="5" x2="12" y2="19"></line>
  <polyline points="19,12 12,19 5,12"></polyline>
  </symbol>
  <symbol id="icon-arrow-left" viewBox="0 0 24 24">
    <line x1="19" y1="12" x2="5" y2="12"></line>
  <polyline points="12,19 5,12 12,5"></polyline>
  </symbol>
  <symbol id="icon-arrow-right" viewBox="0 0 24 24">
    <line x1="5" y1="12" x2="19" y2="12"></line>
  <polyline points="12,5 19,12 12,19"></polyline>
  </symbol>
  <symbol id="icon-arrow-up" viewBox="0 0 24 24">
    <line x1="12" y1="19" x2="12" y2="5"></line>
  <polyline points="5,12 12,5 19,12"></polyline>
  </symbol>
  <symbol id="icon-hamburger" viewBox="0 0 24 24">
    <line x1="3" y1="6" x2="21" y2="6"></line>
  <line x1="3" y1="12" x2="21" y2="12"></line>
  <line x1="3" y1="18" x2="21" y2="18"></line>
  </symbol>
  <symbol id="icon-house" viewBox="0 0 24 24">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
  <polyline points="9,22 9,12 15,12 15,22"></polyline>
  </symbol>
  <symbol id="icon-search" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8"></circle>
  <path d="m21 21-4.35-4.35"></path>
  </symbol>
  <symbol id="icon-cake-icing" viewBox="0 0 24 24">
    <path d="M8 12 L16 12 L15 20 L9 20 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <path d="M8 12 Q9 8 10 12 Q11 8 12 12 Q13 8 14 12 Q15 8 16 12" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <circle cx="12" cy="8" r="1" fill="currentColor"/>
  <path d="M12 7 Q11.5 6 11 6" fill="none" stroke="currentColor" stroke-width="1"/>
  <path d="M11 6 L10.5 5.5 M11 6 L11.5 5.5" fill="none" stroke="currentColor" stroke-width="1"/>
  </symbol>
  <symbol id="icon-palette" viewBox="0 0 24 24">
    <circle cx="12" cy="7" r="5" fill="#ff0000"/>
  <circle cx="7" cy="17" r="5" fill="#ffff00"/>
  <circle cx="17" cy="17" r="5" fill="#00ff00"/>
  </symbol>
  <symbol id="icon-moon" viewBox="0 0 24 24">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </symbol>
  <symbol id="icon-sun" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="5"></circle>
  <line x1="12" y1="1" x2="12" y2="3"></line>
  <line x1="12" y1="21" x2="12" y2="23"></line>
  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
  <line x1="1" y1="12" x2="3" y2="12"></line>
  <line x1="21" y1="12" x2="23" y2="12"></line>
  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </symbol>
  <symbol id="icon-gear" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="3"></circle>
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </symbol>
  <symbol id="icon-wrench" viewBox="0 0 24 24">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
  </symbol>
  <symbol id="icon-admin" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7"></rect>
  <rect x="14" y="3" width="7" height="7"></rect>
  <rect x="14" y="14" width="7" height="7"></rect>
  <rect x="3" y="14" width="7" height="7"></rect>
  </symbol>
  <symbol id="icon-user" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
  <circle cx="12" cy="7" r="4"></circle>
  </symbol>
  <symbol id="icon-users" viewBox="0 0 24 24">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
  <circle cx="9" cy="7" r="4"></circle>
  <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </symbol>
  <symbol id="icon-image" viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
  <circle cx="8.5" cy="8.5" r="1.5"></circle>
  <polyline points="21,15 16,10 5,21"></polyline>
  </symbol>
  <symbol id="icon-book" viewBox="0 0 24 24">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
  </symbol>
  <symbol id="icon-folder" viewBox="0 0 24 24">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </symbol>
  <symbol id="icon-video" viewBox="0 0 24 24">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
  <line x1="7" y1="2" x2="7" y2="22"></line>
  <line x1="17" y1="2" x2="17" y2="22"></line>
  <line x1="2" y1="12" x2="22" y2="12"></line>
  <line x1="2" y1="7" x2="7" y2="7"></line>
  <line x1="2" y1="17" x2="7" y2="17"></line>
  <line x1="17" y1="17" x2="22" y2="17"></line>
  <line x1="17" y1="7" x2="22" y2="7"></line>
  </symbol>
  <symbol id="icon-audio" viewBox="0 0 24 24">
    <path d="M9 18V5l12-2v13"></path>
  <circle cx="6" cy="18" r="3"></circle>
  <circle cx="18" cy="16" r="3"></circle>
  </symbol>
  <symbol id="icon-file" viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
  <polyline points="14 2 14 8 20 8"></polyline>
  <line x1="16" y1="13" x2="8" y2="13"></line>
  <line x1="16" y1="17" x2="8" y2="17"></line>
  <polyline points="10 9 9 9 8 9"></polyline>
  </symbol>
</svg>`;

    document.body.insertBefore(spriteContainer.firstElementChild!, document.body.firstChild);
  }, []);

  return null;
};

export default SpriteLoader;
