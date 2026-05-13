import { websocketHealthMonitor } from './websocket-health-monitor';

/**
 * WebSocket service for real-time updates
 */
class WebSocketService {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private enabledRoutes = [
    '/blog',
    '/blog/',
    '/admin/blog',
    '/admin/blog/edit',
    '/admin/categories',
    '/admin/users',
    '/admin/users/edit',
    '/admin/site-editor',
    '/admin/analytics',
    '/admin/documentation',
    '/admin/documentation/categories',
    '/admin/comments',
    '/profile',
    '/products',
    '/cart',
    '/checkout',
    '/',
    '/all',
    '/russia',
    '/world',
    '/my',
  ];


  
  /**
   * Check if current route should have WebSocket enabled
   */
  shouldEnableForCurrentRoute(): boolean {
    const path = window.location.pathname;
    return this.enabledRoutes.some(route => path.startsWith(route)) || 
           path.includes('/admin/blog') || 
           path.includes('/admin/categories') || 
           path.includes('/admin/users') || 
           path.includes('/admin/site-editor') || 
           path.includes('/admin/analytics') || 
           path.includes('/admin/documentation') ||
           !!path.match(/^\/blog\/\d+$/); // Enable for blog detail pages like /blog/123
  }
  
  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return;
    }
    this.connectionState = 'connecting';
    this.waitForServer().then(() => {
      this.establishConnection();
    }).catch(() => {
      this.connectionState = 'disconnected';
      this.attemptReconnect();
    });
  }

  private async waitForServer(): Promise<void> {
    const maxAttempts = 10;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      if (!navigator.onLine) throw new Error('Offline');
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          return;
        }
      } catch {
        // Server not ready yet
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Server not ready after maximum attempts');
  }

  private establishConnection(): void {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:5000';
    const fullWsUrl = wsUrl.endsWith('/ws') ? wsUrl : `${wsUrl}/ws`;
    
    websocketHealthMonitor.recordConnectionAttempt();
    
    try {
      this.socket = new WebSocket(fullWsUrl);
      
      this.socket.onopen = () => {
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        websocketHealthMonitor.recordSuccessfulConnection();
        this.startHeartbeat();
        this.notifyListeners('_open', { status: 'connected' });
      };
      
      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.notifyListeners(message.type, message.data);
        } catch (error) {
          if (import.meta.env.DEV) console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.socket.onclose = (event) => {
        this.connectionState = 'disconnected';
        this.stopHeartbeat();
        this.notifyListeners('_close', { code: event.code, reason: event.reason });
        this.attemptReconnect();
      };
      
      this.socket.onerror = (error) => {
        this.connectionState = 'disconnected';
        this.stopHeartbeat();
        websocketHealthMonitor.recordConnectionError(error.toString());
      };
    } catch (error) {
      this.connectionState = 'disconnected';
      this.attemptReconnect();
    }
  }
  
  /**
   * Send a message to the WebSocket server
   * @param type Message type
   * @param data Message data
   */
  sendMessage(type: string, data: any): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      this.socket.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }));
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Attempt to reconnect to WebSocket server
   */
  private attemptReconnect() {
    if (!navigator.onLine) {
      // Офлайн — не тратим попытки, ждём события online
      const onOnline = () => {
        window.removeEventListener('online', onOnline);
        this.reconnectAttempts = 0;
        this.connect();
      };
      window.addEventListener('online', onOnline);
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (import.meta.env.DEV) console.log('Max reconnect attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    if (import.meta.env.DEV) console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.connectionState = 'disconnected';
  }
  
  /**
   * Subscribe to WebSocket events
   * @param eventType Event type to subscribe to
   * @param callback Callback function to execute when event occurs
   */
  subscribe(eventType: string, callback: (data: any) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)?.add(callback);
  }
  
  /**
   * Unsubscribe from WebSocket events
   * @param eventType Event type to unsubscribe from
   * @param callback Callback function to remove
   */
  unsubscribe(eventType: string, callback: (data: any) => void) {
    this.listeners.get(eventType)?.delete(callback);
  }
  
  /**
   * Notify all listeners of an event
   * @param eventType Event type
   * @param data Event data
   */
  private notifyListeners(eventType: string, data: any) {
    const listeners = this.listeners.get(eventType);
    if (!listeners || listeners.size === 0) return;
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        if (import.meta.env.DEV) console.error('Error in WebSocket listener callback:', error);
      }
    });
  }
  
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.connectionState === 'connected' && this.socket?.readyState === WebSocket.OPEN;
  }
  
  /**
   * Get connection health status
   */
  getHealthStatus() {
    return websocketHealthMonitor.getHealthStatus();
  }

  /**
   * Clear all listeners - called on client startup to prevent accumulation
   */
  clearAllListeners() {
    this.listeners.clear();
  }
}

export const websocketService = new WebSocketService();

// Clear listeners on startup to prevent accumulation
websocketService.clearAllListeners();

export default websocketService;
