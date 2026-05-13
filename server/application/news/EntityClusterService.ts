import { newsArticleRepository } from '../../infrastructure/persistence/NewsArticleRepository';
import type { NewsArticle } from '../../domain/news/NewsArticle';

const ENTITY_WINDOW_HOURS = 48;
const OTHER_LIMIT = 3;

type ArticleWithEntities = NewsArticle & {
  entities?: { PER?: string[]; ORG?: string[]; LOC?: string[]; FIRST?: string[] } | null;
};

export interface SimilarResult {
  similarArticles: NewsArticle[];
  otherArticles: NewsArticle[];
}

export async function findSimilarArticles(article: ArticleWithEntities): Promise<SimilarResult> {
  const entities = article.entities;
  let similarArticles: NewsArticle[] = [];

  // Шаг 1: первая сущность из заголовка (FIRST), одно совпадение = похожая
  const firstTerm = entities?.FIRST?.[0];
  if (firstTerm) {
    const since = new Date(Date.now() - ENTITY_WINDOW_HOURS * 3_600_000);
    const byFirst = await newsArticleRepository.findByEntities({
      terms: [firstTerm],
      minMatches: 1,
      since,
      excludeId: article.id!,
      limit: 100,
    });
    
    if (byFirst.length > 0) {
      const filtered = filterDuplicatesFromSameSource(byFirst, article.sourceId!);
      if (filtered.length > 0) {
        similarArticles = filtered.slice(0, 6);
      }
    }
  }

  // Шаг 2: cluster_id fallback (только если не нашли по FIRST)
  if (similarArticles.length === 0 && article.clusterId) {
    const byCluster = await newsArticleRepository.findByClusterIdLimited(
      article.clusterId, 100, article.id!
    );
    
    if (byCluster.length > 0) {
      const filtered = filterDuplicatesFromSameSource(byCluster, article.sourceId!);
      if (filtered.length > 0) {
        similarArticles = filtered.slice(0, 6);
      }
    }
  }

  // Шаг 3: всегда добавляем статьи из той же категории в «Другие новости»
  const byCategory = await newsArticleRepository.findRecentByCategory(
    article.category, article.region, OTHER_LIMIT, article.id!
  );
  const filteredCategory = filterDuplicatesFromSameSource(byCategory, article.sourceId!);
  
  return { similarArticles, otherArticles: filteredCategory };
}

/**
 * Filter out duplicates from the same source and normalize titles for deduplication
 */
function filterDuplicatesFromSameSource(articles: NewsArticle[], excludeSourceId: number): NewsArticle[] {
  const seen = new Set<string>();
  return articles.filter(article => {
    // Exclude articles from the same source
    if (article.sourceId === excludeSourceId) return false;
    
    // Deduplicate by normalized title
    const normalizedTitle = normalizeTitle(article.title);
    if (seen.has(normalizedTitle)) return false;
    
    seen.add(normalizedTitle);
    return true;
  });
}

/**
 * Normalize title for deduplication by removing special characters and extra spaces
 */
function normalizeTitle(title: string): string {
  return title.toLowerCase()
    .replace(/[^а-яёa-z0-9\s]/g, '') // Remove special characters, keep letters, numbers, spaces
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
}
