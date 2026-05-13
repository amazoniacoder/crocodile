import * as nodeCron from 'node-cron';
import { db } from '../../db/db';
import { sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';

/**
 * Execute Hot Entities job manually
 */
export async function executeHotEntitiesJob(): Promise<{ count: number }> {
  try {
    const since = new Date(Date.now() - 24 * 3_600_000);

    const result = await db.execute(sql`
      WITH expanded AS (
        SELECT
          e.val AS entity_text,
          CASE
            WHEN (entities->'PER') @> to_jsonb(e.val) THEN 'PER'
            WHEN (entities->'ORG') @> to_jsonb(e.val) THEN 'ORG'
            ELSE 'LOC'
          END AS entity_type
        FROM news_articles,
        LATERAL jsonb_array_elements_text(
          COALESCE(entities->'PER', '[]'::jsonb) ||
          COALESCE(entities->'ORG', '[]'::jsonb) ||
          COALESCE(entities->'LOC', '[]'::jsonb)
        ) AS e(val)
        WHERE entities IS NOT NULL
          AND published_at >= ${since}
          AND is_archived = false
      ),
      counted AS (
        SELECT entity_text, entity_type, COUNT(*)::int AS mention_count
        FROM expanded
        GROUP BY entity_text, entity_type
        ORDER BY mention_count DESC
        LIMIT 100
      )
      INSERT INTO hot_entities (entity_text, entity_type, mention_count, period_start, updated_at)
      SELECT entity_text, entity_type, mention_count, ${since}, NOW()
      FROM counted
      ON CONFLICT (entity_text, entity_type) DO UPDATE
        SET mention_count = EXCLUDED.mention_count,
            period_start  = EXCLUDED.period_start,
            updated_at    = NOW()
      RETURNING 1
    `);

    // Clean up old entities
    await db.execute(sql`
      DELETE FROM hot_entities
      WHERE period_start < NOW() - INTERVAL '48 hours'
    `);

    const count = result.rowCount || 0;
    logger.info(`🔥 Hot Entities job completed: ${count} entities processed`);
    
    return { count };
  } catch (error) {
    logger.error('Hot Entities job failed:', error);
    throw error;
  }
}

export function startHotEntitiesJob(): void {
  nodeCron.schedule('0 * * * *', async () => {
    try {
      await executeHotEntitiesJob();
    } catch (err) {
      console.error('Scheduled HotEntitiesJob error:', err);
    }
  });
}
