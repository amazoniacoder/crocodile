import { WebSocket } from 'ws';
import { webSocketManager } from './infrastructure/cluster/WebSocketManager';
import * as crypto from 'crypto';

/**
 * Отправляет сообщение всем подключенным администраторам
 */
export function broadcastToAdmins(message: any): void {
  try {
    webSocketManager.broadcastToAll({
      type: 'admin_broadcast',
      data: message,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to broadcast to admins:', error);
  }
}

/**
 * Отправляет уведомление о новых статьях
 */
export function broadcastNewsUpdate(data: { timestamp: Date; newArticles: number }): void {
  try {
    webSocketManager.broadcastToAll({
      type: 'news_updated',
      data: { newArticles: data.newArticles },
      timestamp: data.timestamp.toISOString()
    });
  } catch (error) {
    console.error('Failed to broadcast news update:', error);
  }
}

export function createWebSocketHandler(app: any, path: string = '/'): void {
  if (!app.ws) {
    console.error('app.ws is not defined! Express-ws may not be properly initialized.');
    return;
  }

  // Initialize cluster WebSocket subscriptions
  webSocketManager.subscribeToClusterBroadcasts();

  app.ws(path, (ws: WebSocket, req: any) => {
    const connectionId = crypto.randomUUID();
    const clientInfo = {
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      forwardedFor: req.headers['x-forwarded-for']
    };
    
    console.log(`WebSocket connection established on ${path} (${connectionId})`);

    // Register connection in cluster
    webSocketManager.registerConnection(ws, connectionId, clientInfo);

    ws.send(JSON.stringify({
      type: '_connected',
      data: { 
        status: 'connected',
        connectionId,
        nodeId: process.env.NODE_ID || 'unknown'
      },
      timestamp: new Date().toISOString()
    }));

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
        // Send JSON ping as well for client-side handling
        ws.send(JSON.stringify({ 
          type: 'ping', 
          timestamp: new Date().toISOString() 
        }));
      }
    }, 30000);

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'ping' && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ 
            type: 'pong', 
            timestamp: new Date().toISOString() 
          }));
          
          // Update heartbeat in cluster
          await webSocketManager.updateHeartbeat(connectionId);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('pong', async () => {
      // Update heartbeat when receiving pong
      await webSocketManager.updateHeartbeat(connectionId);
    });

    ws.on('close', async () => {
      console.log(`WebSocket connection closed on ${path} (${connectionId})`);
      clearInterval(pingInterval);
      await webSocketManager.unregisterConnection(connectionId);
    });

    ws.on('error', async (error) => {
      console.error('WebSocket error:', error);
      clearInterval(pingInterval);
      await webSocketManager.unregisterConnection(connectionId);
    });
  });
}