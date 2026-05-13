/**
 * Backfill entities for articles from the last 7 days.
 * Run: npx tsx scripts/backfill-entities.ts
 */
import 'dotenv/config';
import { db } from '../server/db/db';
import { newsArticles } from '../shared/types/schema';
import { gte } from 'drizzle-orm';
import { extractEntitiesForArticles } from '../server/infrastructure/ner/NerService';
import { newsArticleRepository } from '../server/infrastructure/persistence/NewsArticleRepository';

const BATCH = 50;
const DAYS = 7;

async function run() {
  const since = new Date(Date.now() - DAYS * 24 * 3_600_000);

  const rows = await db
    .select({ id: newsArticles.id, title: newsArticles.title })
    .from(newsArticles)
    .where(gte(newsArticles.publishedAt, since));

  console.log(`Backfill: ${rows.length} articles to process`);
  if (!rows.length) { process.exit(0); }

  let processed = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const map = await extractEntitiesForArticles(batch);
    for (const [id, entities] of map) {
      if (entities) await newsArticleRepository.updateEntities(id, entities);
    }
    processed += batch.length;
    console.log(`${processed}/${rows.length}`);
  }

  console.log('Done');
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
