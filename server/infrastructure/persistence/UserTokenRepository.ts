import { db } from '../../db/db';
import { eq, sql, desc } from 'drizzle-orm';
import { userTokens } from '../../../shared/types/schema';
import type { UserToken } from '../../domain/user/UserToken';
import { generateUserToken } from '../../domain/user/UserToken';

type UserTokenRow = typeof userTokens.$inferSelect;

function toUserToken(row: UserTokenRow): UserToken {
  return {
    id:         row.id,
    token:      row.token,
    label:      row.label ?? null,
    isActive:   row.isActive,
    isAdmin:    row.isAdmin ?? false,
    createdAt:  row.createdAt,
    expiresAt:  row.expiresAt ?? null,
    lastUsedAt: row.lastUsedAt ?? null,
  };
}

export class UserTokenRepository {
  async findByToken(token: string): Promise<UserToken | null> {
    const rows = await db.select().from(userTokens).where(eq(userTokens.token, token)).limit(1);
    return rows[0] ? toUserToken(rows[0]) : null;
  }

  async findById(id: number): Promise<UserToken | null> {
    const rows = await db.select().from(userTokens).where(eq(userTokens.id, id)).limit(1);
    return rows[0] ? toUserToken(rows[0]) : null;
  }

  async findAll(): Promise<UserToken[]> {
    const rows = await db.select().from(userTokens).orderBy(desc(userTokens.createdAt));
    return rows.map(toUserToken);
  }

  async findAdminToken(): Promise<UserToken | null> {
    const rows = await db.select().from(userTokens).where(eq(userTokens.isAdmin, true)).limit(1);
    return rows[0] ? toUserToken(rows[0]) : null;
  }

  async insert(data: { label: string; expiresAt?: Date }): Promise<UserToken> {
    const token = generateUserToken();
    const rows = await db.insert(userTokens).values({
      token,
      label:     data.label,
      expiresAt: data.expiresAt ?? null,
    }).returning();
    return toUserToken(rows[0]);
  }

  async update(id: number, data: Partial<Pick<UserToken, 'label' | 'isActive' | 'expiresAt'>>): Promise<void> {
    if (Object.keys(data).length === 0) return;
    await db.update(userTokens).set(data).where(eq(userTokens.id, id));
  }

  async delete(id: number): Promise<void> {
    await db.delete(userTokens).where(eq(userTokens.id, id));
  }

  async updateLastUsed(id: number): Promise<void> {
    await db.update(userTokens).set({ lastUsedAt: new Date() }).where(eq(userTokens.id, id));
  }

  async getStats(): Promise<{ activeTokens: number; totalTokens: number }> {
    const rows = await db.select({
      activeTokens: sql<number>`COUNT(*) FILTER (WHERE ${userTokens.isActive} = true)`,
      totalTokens:  sql<number>`COUNT(*)`,
    }).from(userTokens);
    return {
      activeTokens: Number(rows[0]?.activeTokens ?? 0),
      totalTokens:  Number(rows[0]?.totalTokens ?? 0),
    };
  }
}

export const userTokenRepository = new UserTokenRepository();
