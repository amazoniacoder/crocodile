import React, { useState, useEffect, useRef } from 'react';
import { EmotionPicker, EMOTIONS, EmotionId } from './EmotionPicker';
import { reactionsStore, getBrowserId } from '@/services/reactions';
import { enqueuePendingAction } from '@/services/pendingActionsService';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useDisplaySettings } from '@/contexts/display-settings-context';
import { isArticleEmotionId } from '@shared/constants/articleEmotions';

interface Props {
  articleId: number;
  showEmotions?: boolean;
  showVotes?: boolean;
}

type ReactionRow = {
  likes: number;
  dislikes: number;
  myReaction: string | null;
  myEmotion: string | null;
  emotionCounts: Record<string, number>;
};

const ThumbUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
  </svg>
);

const ThumbDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
    <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
  </svg>
);

const NeutralFace = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.45">
    <circle cx="12" cy="12" r="10"/>
    <line x1="8" y1="15" x2="16" y2="15"/>
    <line x1="9" y1="9" x2="9.01" y2="9"/>
    <line x1="15" y1="9" x2="15.01" y2="9"/>
  </svg>
);

type EmotionCounts = Record<string, number>;

export const ArticleReactions: React.FC<Props> = ({ articleId, showEmotions: showEmotionsProp = true, showVotes = true }) => {
  const { settings } = useDisplaySettings();
  const showEmotions = settings.showEmotions && showEmotionsProp;
  const online = useOnlineStatus();
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);

  const [emotionCounts, setEmotionCounts] = useState<EmotionCounts>({});
  const [myEmotion, setMyEmotion] = useState<EmotionId | null>(null);
  const [newEmotion, setNewEmotion] = useState<EmotionId | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!online) return; // Офлайн — не запрашиваем
    const controller = new AbortController();

    void (async () => {
      try {
        const r = await fetch(`/api/news/reaction-counts?ids=${articleId}`, {
          headers: { 'x-browser-id': getBrowserId() },
          signal: controller.signal,
          cache: 'no-store',
        });
        const data = (await r.json()) as Record<string, ReactionRow>;
        if (controller.signal.aborted) return;

        let row = data[String(articleId)];
        if (!row) return;

        if (row.myEmotion == null) {
          const localEm = reactionsStore.getEmotion(articleId);
          if (localEm && isArticleEmotionId(localEm)) {
            const mig = await fetch(`/api/news/${articleId}/emotion`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-browser-id': getBrowserId() },
              body: JSON.stringify({ emotionId: localEm }),
              signal: controller.signal,
              cache: 'no-store',
            });
            if (controller.signal.aborted) return;
            if (mig.ok) {
              reactionsStore.clearEmotion(articleId);
              let migratedCounts = row.emotionCounts ?? {};
              try {
                const body = await mig.json() as { emotionCounts?: EmotionCounts };
                if (body.emotionCounts && typeof body.emotionCounts === 'object') migratedCounts = body.emotionCounts;
              } catch { /* без тела emotionCounts остаётся локальная сумма */ }
              row = { ...row, myEmotion: localEm, emotionCounts: migratedCounts };
            }
          }
        }

        setLikes(row.likes ?? 0);
        setDislikes(row.dislikes ?? 0);
        setEmotionCounts(row.emotionCounts ?? {});

        const me = row.myEmotion;
        setMyEmotion(me && isArticleEmotionId(me) ? me : null);

        if (row.myReaction === 'like') {
          setLiked(true);
          setDisliked(false);
        } else if (row.myReaction === 'dislike') {
          setDisliked(true);
          setLiked(false);
        } else {
          setLiked(reactionsStore.hasLiked(articleId));
          setDisliked(reactionsStore.hasDisliked(articleId));
        }
      } catch {}
    })();

    return () => controller.abort();
  }, [articleId, online]);

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  useEffect(() => {
    if (!newEmotion) return;
    const t = setTimeout(() => setNewEmotion(null), 500);
    return () => clearTimeout(t);
  }, [newEmotion]);

  const sendReaction = async (type: 'like' | 'dislike') => {
    if (!online) {
      await enqueuePendingAction('react', { articleId, type });
      return;
    }
    try {
      const res = await fetch(`/api/news/${articleId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-browser-id': getBrowserId() },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        const data = await res.json();
        setLikes(data.likes ?? 0);
        setDislikes(data.dislikes ?? 0);
      }
    } catch {
      // Сеть пропала после оптимистичного UI — кладём в очередь
      await enqueuePendingAction('react', { articleId, type });
    }
  };

  const handleLike = () => {
    if (liked) return;
    reactionsStore.setLike(articleId);
    setLiked(true);
    setDisliked(false);
    void sendReaction('like');
  };

  const handleDislike = () => {
    if (disliked) return;
    reactionsStore.setDislike(articleId);
    setDisliked(true);
    setLiked(false);
    void sendReaction('dislike');
  };

  /** Палитру закрываем кликом снаружи или после выбора; по зоне эмодзи только открываем. */
  const openPicker = () => setPickerOpen(true);

  const handleSelectEmotion = (id: EmotionId) => {
    void (async () => {
      const prev = myEmotion;
      // Оптимистичный UI — сразу
      setMyEmotion(id);
      if (id !== prev) setNewEmotion(id);
      setPickerOpen(false);
      setEmotionCounts(counts => ({
        ...counts,
        [id]: (counts[id] ?? 0) + 1,
        ...(prev !== null && prev !== id ? { [prev]: Math.max(0, (counts[prev] ?? 1) - 1) } : {}),
      }));

      if (!online) {
        await enqueuePendingAction('emotion', { articleId, emotionId: id });
        return;
      }

      try {
        const res = await fetch(`/api/news/${articleId}/emotion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-browser-id': getBrowserId() },
          body: JSON.stringify({ emotionId: id }),
          cache: 'no-store',
        });
        if (!res.ok) {
          await enqueuePendingAction('emotion', { articleId, emotionId: id });
          return;
        }
        reactionsStore.clearEmotion(articleId);
        try {
          const body = await res.json() as { emotionCounts?: EmotionCounts };
          if (body.emotionCounts && typeof body.emotionCounts === 'object') {
            setEmotionCounts(body.emotionCounts);
          }
        } catch { /* без тела */ }
      } catch {
        await enqueuePendingAction('emotion', { articleId, emotionId: id });
      }
    })();
  };

  /** Порядок как в палитре: показываем типы с ненулевым суммой + мою текущую (до синка с сервером). */
  const chips = EMOTIONS.filter(
    ({ id }) => (emotionCounts[id] ?? 0) > 0 || id === myEmotion
  );

  const showNeutralInStrip = chips.length === 0;

  return (
    <div className="article-reactions">
      <div className={`article-reactions__emotions-wrap${!showEmotions ? ' article-reactions__emotions-wrap--hidden' : ''}`} ref={pickerRef}>
        <div
          role="button"
          tabIndex={0}
          className={`article-reactions__emotion-hit${showNeutralInStrip ? ' article-reactions__emotion-hit--empty' : ''}`}
          aria-label="Эмодзи-реакции"
          aria-expanded={pickerOpen}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openPicker();
            }
          }}
        >
          <div className="article-reactions__chips">
            {showNeutralInStrip ? (
              <div className="article-reactions__chip article-reactions__chip--neutral" aria-hidden title="Выбрать эмодзи">
                <NeutralFace />
              </div>
            ) : (
              chips.map(({ id, emoji, label }) => (
                <div
                  key={id}
                  className={`article-reactions__chip${myEmotion === id ? ' article-reactions__chip--mine' : ''}${newEmotion === id ? ' article-reactions__emotion--new' : ''}`}
                  title={`${label} · всего ${emotionCounts[id] ?? 1}`}
                >
                  <span className="article-reactions__chip-emoji">{emoji}</span>
                  <span className="article-reactions__chip-count">{emotionCounts[id] ?? (myEmotion === id ? 1 : 0)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {pickerOpen && (
          <EmotionPicker onSelect={handleSelectEmotion} onClose={() => setPickerOpen(false)} />
        )}
      </div>

      {showVotes && (
      <div className="article-reactions__votes">
        <button
          className={`article-reactions__like${liked ? ' article-reactions__like--active' : ''}`}
          onClick={handleLike}
          title="Нравится"
          disabled={liked}
          type="button"
        >
          <ThumbUp />
          {likes > 0 && <span>{likes}</span>}
        </button>

        <button
          className={`article-reactions__dislike${disliked ? ' article-reactions__dislike--active' : ''}`}
          onClick={handleDislike}
          title="Не нравится"
          disabled={disliked}
          type="button"
        >
          <ThumbDown />
          {dislikes > 0 && <span>{dislikes}</span>}
        </button>
      </div>
      )}
    </div>
  );
};
