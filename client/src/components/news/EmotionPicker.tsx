import React from 'react';
import { ARTICLE_EMOTIONS, type ArticleEmotionId } from '@shared/constants/articleEmotions';

export const EMOTIONS = ARTICLE_EMOTIONS;
export type EmotionId = ArticleEmotionId;

interface Props {
  onSelect: (id: EmotionId) => void;
  onClose: () => void;
}

export const EmotionPicker: React.FC<Props> = ({ onSelect, onClose }) => (
  <div className="emotion-picker" role="menu">
    {EMOTIONS.map(e => (
      <button
        key={e.id}
        className="emotion-picker__btn"
        title={e.label}
        onClick={() => { onSelect(e.id); onClose(); }}
        role="menuitem"
      >
        {e.emoji}
      </button>
    ))}
  </div>
);
