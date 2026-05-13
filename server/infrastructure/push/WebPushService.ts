import webPush from 'web-push';
import { db } from '../../db/db';
import { pushSubscriptions, userChannelSubscriptions } from '../../../shared/types/schema';
import { eq, inArray, isNull, or } from 'drizzle-orm';
import { logger } from '../../utils/logger';

export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

class WebPushService {
  private initialized = false;

  initialize(): void {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

    if (!publicKey || !privateKey) {
      logger.warn('VAPID keys not configured — Web Push disabled. Generate with: npx web-push generate-vapid-keys');
      return;
    }

    webPush.setVapidDetails(subject, publicKey, privateKey);
    this.initialized = true;
    logger.info('🔔 Web Push initialized');
  }

  isEnabled(): boolean {
    return this.initialized;
  }

  getPublicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY ?? null;
  }

  async saveSubscription(data: PushSubscriptionData & { tokenId?: number }): Promise<void> {
    await db
      .insert(pushSubscriptions)
      .values({
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        tokenId: data.tokenId ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          p256dh: data.keys.p256dh,
          auth: data.keys.auth,
          tokenId: data.tokenId ?? null,
        },
      });
  }

  async deleteSubscription(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async broadcast(payload: PushPayload): Promise<void> {
    if (!this.initialized) return;

    const body = JSON.stringify(payload);
    const BATCH_SIZE = 100;
    let offset = 0;
    let totalStale = 0;

    while (true) {
      const batch = await db.select().from(pushSubscriptions).limit(BATCH_SIZE).offset(offset);
      if (batch.length === 0) break;

      const stale: string[] = [];
      await Promise.allSettled(
        batch.map(async (sub) => {
          try {
            await webPush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              body,
            );
          } catch (err: any) {
            if (err.statusCode === 404 || err.statusCode === 410) {
              stale.push(sub.endpoint);
            } else {
              logger.warn('Push send error:', err.message);
            }
          }
        }),
      );

      if (stale.length > 0) {
        await Promise.all(stale.map((ep) => this.deleteSubscription(ep)));
        totalStale += stale.length;
      }

      offset += BATCH_SIZE;
    }

    if (totalStale > 0) {
      logger.info(`🔔 Removed ${totalStale} stale push subscriptions`);
    }
  }

  /**
   * Отправляет push только подписчикам, у которых есть подписки на указанные источники.
   * Браузерные push без токена (анонимные) получают уведомление всегда.
   */
  async broadcastToSubscribers(payload: PushPayload, sourceIds: number[]): Promise<void> {
    if (!this.initialized || sourceIds.length === 0) return;

    // Находим token_id подписчиков, у которых есть подписка хоть бы на один из sourceIds
    const matchingRows = await db
      .selectDistinct({ tokenId: userChannelSubscriptions.tokenId })
      .from(userChannelSubscriptions)
      .where(inArray(userChannelSubscriptions.sourceId, sourceIds));

    const matchingTokenIds = matchingRows.map(r => r.tokenId);

    // Берём push-подписки:
    // - без токена (анонимные) — всегда
    // - с токеном из matchingTokenIds
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(
        matchingTokenIds.length > 0
          ? or(isNull(pushSubscriptions.tokenId), inArray(pushSubscriptions.tokenId, matchingTokenIds))
          : isNull(pushSubscriptions.tokenId)
      );

    if (subs.length === 0) return;

    const body = JSON.stringify(payload);
    const stale: string[] = [];

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
          );
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            stale.push(sub.endpoint);
          } else {
            logger.warn('Push send error:', err.message);
          }
        }
      }),
    );

    if (stale.length > 0) {
      await Promise.all(stale.map((ep) => this.deleteSubscription(ep)));
      logger.info(`🔔 Removed ${stale.length} stale push subscriptions`);
    }
  }
}

export const webPushService = new WebPushService();
