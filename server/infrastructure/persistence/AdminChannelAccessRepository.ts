import { db } from '../../db/db';
import { adminChannelAccess, newsSources } from '../../../shared/types/schema';
import { eq, and, inArray } from 'drizzle-orm';

export class AdminChannelAccessRepository {
  /**
   * Получить ID источников, доступных админу
   */
  async getAccessibleSourceIds(tokenId: number): Promise<number[]> {
    const rows = await db
      .select({ sourceId: adminChannelAccess.sourceId })
      .from(adminChannelAccess)
      .where(eq(adminChannelAccess.tokenId, tokenId));
    
    return rows.map(r => r.sourceId);
  }

  /**
   * Предоставить админу доступ к приватному каналу
   */
  async grantAccess(tokenId: number, sourceId: number): Promise<void> {
    await db
      .insert(adminChannelAccess)
      .values({ tokenId, sourceId })
      .onConflictDoNothing();
  }

  /**
   * Отозвать доступ админа к приватному каналу
   */
  async revokeAccess(tokenId: number, sourceId: number): Promise<void> {
    await db
      .delete(adminChannelAccess)
      .where(
        and(
          eq(adminChannelAccess.tokenId, tokenId),
          eq(adminChannelAccess.sourceId, sourceId)
        )
      );
  }

  /**
   * Получить список админов, имеющих доступ к каналу
   */
  async getAdminsWithAccess(sourceId: number): Promise<number[]> {
    const rows = await db
      .select({ tokenId: adminChannelAccess.tokenId })
      .from(adminChannelAccess)
      .where(eq(adminChannelAccess.sourceId, sourceId));
    
    return rows.map(r => r.tokenId);
  }

  /**
   * Удалить все доступы к каналу (при удалении канала)
   */
  async revokeAllAccess(sourceId: number): Promise<void> {
    await db
      .delete(adminChannelAccess)
      .where(eq(adminChannelAccess.sourceId, sourceId));
  }

  /**
   * Проверить, имеет ли админ доступ к каналу
   */
  async hasAccess(tokenId: number, sourceId: number): Promise<boolean> {
    const [row] = await db
      .select({ id: adminChannelAccess.id })
      .from(adminChannelAccess)
      .where(
        and(
          eq(adminChannelAccess.tokenId, tokenId),
          eq(adminChannelAccess.sourceId, sourceId)
        )
      )
      .limit(1);
    
    return !!row;
  }

  /**
   * Получить приватные каналы, доступные админу (с полной информацией)
   */
  async getAccessiblePrivateChannels(tokenId: number) {
    const rows = await db
      .select({
        id: newsSources.id,
        name: newsSources.name,
        url: newsSources.url,
        rssUrl: newsSources.rssUrl,
        sourceType: newsSources.sourceType,
        region: newsSources.region,
        category: newsSources.category,
        logoUrl: newsSources.logoUrl,
        username: newsSources.username,
        channelId: newsSources.channelId,
        isActive: newsSources.isActive,
        isFeatured: newsSources.isFeatured,
        isPrivate: newsSources.isPrivate,
      })
      .from(adminChannelAccess)
      .innerJoin(newsSources, eq(adminChannelAccess.sourceId, newsSources.id))
      .where(
        and(
          eq(adminChannelAccess.tokenId, tokenId),
          eq(newsSources.isPrivate, true),
          eq(newsSources.isActive, true)
        )
      );
    
    return rows;
  }
}

export const adminChannelAccessRepository = new AdminChannelAccessRepository();
