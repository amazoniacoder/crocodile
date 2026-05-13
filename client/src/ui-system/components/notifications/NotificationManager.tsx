import React, { createContext, useContext, useState, useCallback } from 'react';
import UnifiedNotification, { NotificationProps } from './UnifiedNotification';

interface NotificationItem extends NotificationProps { id: string; }

interface NotificationContextType {
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  hideNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const add = useCallback((n: Omit<NotificationItem, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev.slice(-2), { ...n, id }]);
    return id;
  }, []);

  const remove = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const showSuccess = useCallback((message: string, title = 'Успешно') => {
    add({ type: 'success', message, title, duration: 4000, autoClose: true, onClose: () => {} });
  }, [add]);

  const showError = useCallback((message: string, title = 'Ошибка') => {
    add({ type: 'error', message, title, duration: 5000, autoClose: true, onClose: () => {} });
  }, [add]);

  const showInfo = useCallback((message: string, title = 'Информация') => {
    add({ type: 'info', message, title, duration: 3000, autoClose: true, onClose: () => {} });
  }, [add]);

  return (
    <NotificationContext.Provider value={{ showSuccess, showError, showInfo, hideNotification: remove }}>
      {children}
      {notifications.map(n => (
        <UnifiedNotification key={n.id} {...n} onClose={() => remove(n.id)} />
      ))}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};

export const useNotification = useNotifications;
export const useGlobalNotifications = useNotifications;
export const showSuccessNotification = (message: string) => console.log('Success:', message);
export const showErrorNotification = (message: string) => console.error('Error:', message);
