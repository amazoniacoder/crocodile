import type { NewsRegion, NewsCategory } from './NewsArticle';

export interface NewsCluster {
  id: number;
  title: string;
  articleCount: number;
  region: NewsRegion;
  category: NewsCategory;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export type NewClusterInput = Omit<NewsCluster, 'id'>;

const STOP_WORDS = new Set([
  'заявил', 'заявила', 'заявили', 'сообщил', 'сообщила', 'сообщили',
  'рассказал', 'рассказала', 'назвал', 'назвала', 'стало', 'стала',
  'после', 'будет', 'будут', 'этого', 'этот', 'этой', 'этом', 'также',
  'более', 'своих', 'своей', 'своем', 'году', 'года', 'годов', 'тысяч',
  'миллионов', 'миллиарда', 'миллиардов', 'рублей', 'долларов',
  'that', 'this', 'with', 'from', 'have', 'been', 'will', 'were',
  'said', 'says', 'over', 'after', 'into', 'their', 'about', 'which',
  'would', 'could', 'should', 'first', 'last', 'year', 'years',
]);

const MIN_WORD_LENGTH = 4;
export const MIN_COMMON_WORDS = 2;

export function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\wа-яёa-z\s]/gi, '')
      .split(/\s+/)
      .filter(w => w.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(w))
  );
}

/** Возвращает количество общих токенов между двумя заголовками */
export function titleSimilarity(titleA: string, titleB: string): number {
  const tokensA = tokenize(titleA);
  const tokensB = tokenize(titleB);
  let common = 0;
  for (const word of tokensA) {
    if (tokensB.has(word)) common++;
  }
  return common;
}

/** Два заголовка считаются похожими если общих токенов >= MIN_COMMON_WORDS */
export function areSimilar(titleA: string, titleB: string): boolean {
  return titleSimilarity(titleA, titleB) >= MIN_COMMON_WORDS;
}

/**
 * Нормализованная версия tokenize с приведением токенов к именительному падежу.
 * normalize — функция нормализации из NerService (или identity при деградации)
 */
export async function tokenizeNormalized(
  title: string,
  normalize: (tokens: string[]) => Promise<string[]>
): Promise<Set<string>> {
  const raw = Array.from(tokenize(title));
  const normalized = await normalize(raw);
  return new Set(normalized);
}

/**
 * Нормализованное сравнение заголовков с учётом морфологии.
 * При normalize = identity поведение идентично areSimilar.
 */
export async function areSimilarNormalized(
  titleA: string,
  titleB: string,
  normalize: (tokens: string[]) => Promise<string[]>
): Promise<boolean> {
  const [tokensA, tokensB] = await Promise.all([
    tokenizeNormalized(titleA, normalize),
    tokenizeNormalized(titleB, normalize),
  ]);
  let common = 0;
  for (const word of tokensA) {
    if (tokensB.has(word)) common++;
  }
  return common >= MIN_COMMON_WORDS;
}
