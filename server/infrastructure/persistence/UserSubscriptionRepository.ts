import { db } from '../../db/db';
import { eq, sql } from 'drizzle-orm';
import { userChannelSubscriptions } from '../../../shared/types/schema';

export class UserSubscriptionRepository {
  async findByTokenId(tokenId: number): Promise<number[]> {
    const rows = await db
      .select({ sourceId: userChannelSubscriptions.sourceId })
      .from(userChannelSubscriptions)
      .where(eq(userChannelSubscriptions.tokenId, tokenId));
    return rows.map(r => r.sourceId);
  }

  async replaceSubscriptions(tokenId: number, sourceIds: number[]): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(userChannelSubscriptions)
        .where(eq(userChannelSubscriptions.tokenId, tokenId));

      if (sourceIds.length > 0) {
        await tx.insert(userChannelSubscriptions)
          .values(sourceIds.map(sourceId => ({ tokenId, sourceId })))
          .onConflictDoNothing();
      }
    });
  }

  async getStats(): Promise<{ totalSubscriptions: number }> {
    const rows = await db.select({
      total: sql<number>`COUNT(*)`,
    }).from(userChannelSubscriptions);
    return { totalSubscriptions: Number(rows[0]?.total ?? 0) };
  }
}

export const userSubscriptionRepository = new UserSubscriptionRepository();
