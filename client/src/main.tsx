import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './ui-system/main.css';
import { scheduleOfflineGC } from './services/offlineStore';
import { flushOnOnline } from './services/pendingActionsService';

const updateSW = registerSW({
  onOfflineReady() {
    console.info('[PWA] Оболочка доступна офлайн');
  },
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('pwa:needRefresh', { detail: { updateSW: () => updateSW(true) } }));
  },
});

// GC при старте и при возврате вкладки — не чаще раза в сутки
scheduleOfflineGC();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') scheduleOfflineGC();
});

// Сброс офлайн-реакций при появлении сети (fallback для iOS)
flushOnOnline();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
