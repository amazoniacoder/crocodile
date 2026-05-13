import React, { useState } from 'react';
import { ARTICLE_EMOTIONS } from '@shared/constants/articleEmotions';
import { adminApi } from '@/services/adminApi';

interface ReactionRow {
  articleId: number;
  title: string;
  likes: number;
  dislikes: number;
  emotions: Record<string, number>;
}

interface Props {
  token: string;
  likes: number;
  dislikes: number;
  top: ReactionRow[];
  hours: number;
  /** После успешной очистки данных */
  onReload: () => void;
  /** При изменении периода времени */
  onPeriodChange: (hours: number) => void;
}

const TIME_PERIODS = [
  { value: 24, label: '24 часа' },
  { value: 48, label: '2 дня' },
  { value: 72, label: '3 дня' },
  { value: 168, label: '7 дней' },
] as const;

export const ReactionsTable: React.FC<Props> = ({ 
  token, 
  likes, 
  dislikes, 
  top, 
  hours,
  onReload, 
  onPeriodChange 
}) => {
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    const ok = window.confirm(
      'Удалить все лайки, дизлайки и эмодзи по всем новостям?\nОбнулится денормализованный счётчик на карточках. Действие необратимо.'
    );
    if (!ok) return;
    setClearing(true);
    try {
      await adminApi.deleteAllAnalyticsReactions(token);
      onReload();
    } catch {
      window.alert('Не удалось очистить данные. Проверьте права или сеть.');
    } finally {
      setClearing(false);
    }
  };

  const currentPeriod = TIME_PERIODS.find(p => p.value === hours) || TIME_PERIODS[0];

  return (
    <div className="monitor-card">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 className="monitor-card__title" style={{ marginBottom: 0 }}>Реакции</h3>
          <select 
            className="monitor-select"
            value={hours}
            onChange={(e) => onPeriodChange(Number(e.target.value))}
            style={{ minWidth: '120px' }}
          >
            {TIME_PERIODS.map(period => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="monitor-btn monitor-btn--danger"
          disabled={clearing}
          onClick={() => void handleClear()}
          title="Удалить все реакции и эмодзи по всем статьям"
        >
          {clearing ? 'Очистка…' : 'Очистить все'}
        </button>
      </div>
      
      <p style={{ margin: '0 0 12px', opacity: 0.75, fontSize: 'var(--font-size-sm)' }}>
        Статьи с активностью за {currentPeriod.label.toLowerCase()}. Всего лайков: <strong style={{ color: 'var(--color-success)' }}>{likes.toLocaleString('ru')}</strong>, дизлайков: <strong style={{ color: 'var(--color-error)' }}>{dislikes.toLocaleString('ru')}</strong>.
      </p>
      
      {top.length === 0 ? (
        <p className="monitor-chart__empty">Нет данных за выбранный период</p>
      ) : (
        <div className="monitor-table-wrap">
          <table className="monitor-table monitor-table--reactions">
            <thead>
              <tr>
                <th>#</th>
                <th>Заголовок</th>
                <th>👍</th>
                <th>👎</th>
                {ARTICLE_EMOTIONS.map((e) => (
                  <th key={e.id} className="monitor-table__narrow" title={e.label}>{e.emoji}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top.map((r, i) => (
                <tr key={r.articleId}>
                  <td className="monitor-table__muted">{i + 1}</td>
                  <td>{r.title}</td>
                  <td style={{ color: 'var(--color-success)' }}><strong>{r.likes}</strong></td>
                  <td style={{ color: 'var(--color-error)' }}>{r.dislikes}</td>
                  {ARTICLE_EMOTIONS.map((e) => (
                    <td key={e.id} className="monitor-table__muted monitor-table__narrow">
                      {(r.emotions?.[e.id] ?? 0).toLocaleString('ru')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
