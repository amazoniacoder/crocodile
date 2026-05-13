import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import websocketService from '../services/websocket-service';
import WebSocketHealthMonitor from '../services/websocket-health';

interface WebSocketContextType {
  connected: boolean;
  lastMessage: any;
}

const WebSocketContext = createContext<WebSocketContextType>({ connected: false, lastMessage: null });

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [location] = useLocation();

  useEffect(() => {
    if (!websocketService.shouldEnableForCurrentRoute()) {
      websocketService.disconnect();
      setConnected(false);
      return;
    }

    websocketService.connect();
    const healthMonitor = new WebSocketHealthMonitor(websocketService);
    healthMonitor.start();
    setConnected(websocketService.isConnected());

    const handleOpen = () => setConnected(true);
    const handleClose = () => setConnected(false);
    const handleMessage = (message: any) => setLastMessage(message);

    websocketService.subscribe('_open', handleOpen);
    websocketService.subscribe('_close', handleClose);
    websocketService.subscribe('_connected', handleOpen);
    websocketService.subscribe('news_updated', handleMessage);

    return () => {
      websocketService.unsubscribe('_open', handleOpen);
      websocketService.unsubscribe('_close', handleClose);
      websocketService.unsubscribe('_connected', handleOpen);
      websocketService.unsubscribe('news_updated', handleMessage);
      if (!websocketService.shouldEnableForCurrentRoute()) websocketService.disconnect();
    };
  }, [location]);

  return (
    <WebSocketContext.Provider value={{ connected, lastMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
