/**
 * Notifications System Exports
 */

export { default as UnifiedNotification } from './UnifiedNotification';
export type { NotificationProps } from './UnifiedNotification';

export { 
  NotificationProvider, 
  useNotifications,
  showSuccessNotification,
  showErrorNotification 
} from './NotificationManager';

// Import CSS
import './notifications.css';