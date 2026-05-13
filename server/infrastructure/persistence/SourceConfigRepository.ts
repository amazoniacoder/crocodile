import { db } from '../../db/db';
import { sourceConfig } from '../../../shared/types/schema';
import { eq } from 'drizzle-orm';
import type { SourceConfig, SourceConfigKey } from '../../domain/monitoring/SourceConfig';
import { SOURCE_CONFIG_DEFAULTS } from '../../domain/monitoring/SourceConfig';

export const sourceConfigRepository = {
  async get(key: SourceConfigKey): Promise<string> {
    const rows = await db
      .select()
      .from(sourceConfig)
      .where(eq(sourceConfig.key, key))
      .limit(1);
    return rows[0]?.value ?? SOURCE_CONFIG_DEFAULTS[key];
  },

  async getAll(): Promise<SourceConfig[]> {
    const rows = await db.select().from(sourceConfig) as SourceConfig[];
    const rowMap = new Map(rows.map((r) => [r.key, r]));

    const mergedDefaults = (Object.keys(SOURCE_CONFIG_DEFAULTS) as SourceConfigKey[]).map((key) => {
      const row = rowMap.get(key);
      return row ?? {
        key,
        value: SOURCE_CONFIG_DEFAULTS[key],
        updatedAt: new Date(0),
      };
    });

    const otherRows = rows.filter((r) => !(r.key in SOURCE_CONFIG_DEFAULTS));
    return [...mergedDefaults, ...otherRows];
  },

  async set(key: SourceConfigKey, value: string): Promise<void> {
    await db
      .insert(sourceConfig)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: sourceConfig.key,
        set: { value, updatedAt: new Date() },
      });
  },
};
