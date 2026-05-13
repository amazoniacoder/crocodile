export const ARTICLE_EMOTIONS = [
  { id: 'smile', emoji: '😊', label: 'Улыбка' },
  { id: 'surprise', emoji: '😮', label: 'Удивление' },
  { id: 'angry', emoji: '😡', label: 'Злость' },
  { id: 'cry', emoji: '😢', label: 'Плачет' },
  { id: 'sick', emoji: '🤢', label: 'Блюет' },
] as const;

export type ArticleEmotionId = (typeof ARTICLE_EMOTIONS)[number]['id'];

export function isArticleEmotionId(id: unknown): id is ArticleEmotionId {
  return typeof id === 'string' && ARTICLE_EMOTIONS.some((e) => e.id === id);
}
