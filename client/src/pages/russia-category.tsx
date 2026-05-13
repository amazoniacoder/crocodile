import React from 'react';
import { useParams } from 'wouter';
import { NewsAggregator } from '@/components/news/NewsAggregator';
import { NEWS_CATEGORIES } from '../../../shared/types/news';
import type { NewsCategory } from '../../../shared/types/news';

const RussiaCategoryPage: React.FC = () => {
  const { category } = useParams<{ category: string }>();
  const validCategory = (NEWS_CATEGORIES as readonly string[]).includes(category ?? '')
    ? (category as NewsCategory)
    : null;

  if (!validCategory) return null;

  return <NewsAggregator region="russia" category={validCategory} />;
};

export default RussiaCategoryPage;
