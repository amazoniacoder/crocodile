import { eventBus } from '../../infrastructure/events/EventBus';
import { queryCacheService } from '../../infrastructure/monitoring/QueryCacheService';
import { webSocketManager } from '../../infrastructure/cluster/WebSocketManager';
import { webPushService } from '../../infrastructure/push/WebPushService';

const PUSH_THRESHOLD = parseInt(process.env.PUSH_THRESHOLD ?? '5', 10);

/** Инвалидирует кэш новостей после кластеризации */
export function initCacheSubscriber(): void {
  eventBus.on('cluster.updated', async () => {
    await queryCacheService.invalidateByTags(['news', 'clusters']);
  });
}

/** Бродкастит news_updated всем WebSocket-клиентам после кластеризации */
export function initWebSocketSubscriber(): void {
  eventBus.on('cluster.updated', async (event) => {
    // Use cluster-aware WebSocket manager instead of global wss
    await webSocketManager.broadcastToCluster({
      type: 'news_updated',
      data: { 
        timestamp: event.occurredAt.toISOString(),
        newArticles: 0 // ClusterUpdated event doesn't have insertedCount
      },
      timestamp: new Date().toISOString()
    });
  });

  // Also handle articles.collected events for immediate notifications
  eventBus.on('articles.collected', async (event) => {
    if (event.insertedCount > 0) {
      await webSocketManager.broadcastToCluster({
        type: 'news_updated',
        data: {
          timestamp: event.occurredAt.toISOString(),
          newArticles: event.insertedCount,
          sourceName: event.sourceName
        },
        timestamp: new Date().toISOString()
      });
    }

    if (event.insertedCount >= PUSH_THRESHOLD) {
      // Отправляем только подписчикам с подписками на источник
      const sourceId = event.sourceId;
      if (sourceId) {
        webPushService.broadcastToSubscribers(
          {
            title: 'Новые статьи',
            body: `Появилось ${event.insertedCount} новых материалов`,
            url: '/my',
          },
          [sourceId]
        ).catch(() => {/* silent */});
      } else {
        // Батчевый сбор — броадкаст всем
        webPushService.broadcast({
          title: 'Новые статьи',
          body: `Появилось ${event.insertedCount} новых материалов`,
          url: '/',
        }).catch(() => {/* silent */});
      }
    }
  });
}
