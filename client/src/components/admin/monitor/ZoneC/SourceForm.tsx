import React, { useState, useEffect } from 'react';
import { adminApi, NewsSource } from '@/services/adminApi';
import { NEWS_REGIONS, NEWS_CATEGORIES } from '@newsaggregator/shared/types/news';

interface Props {
  token: string;
  source?: NewsSource | null;
  onClose: () => void;
  onSaved: () => void;
}

type FormData = Omit<NewsSource, 'id' | 'lastFetchedAt' | 'createdAt' | 'isActive' | 'isFeatured'>;

const EMPTY: FormData = { name: '', url: '', rssUrl: '', region: 'russia', category: 'other', city: '', sourceType: 'rss' };

export const SourceForm: React.FC<Props> = ({ token, source, onClose, onSaved }) => {
  const [form, setForm] = useState<FormData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (source) {
      setForm({ name: source.name, url: source.url, rssUrl: source.rssUrl, region: source.region as FormData['region'], category: source.category as FormData['category'], city: source.city ?? '', sourceType: source.sourceType ?? 'rss' });
    } else {
      setForm(EMPTY);
    }
  }, [source]);

  const set = (field: keyof FormData, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = { ...form, city: form.city || null };
      if (source) {
        await adminApi.updateSource(token, source.id, data);
      } else {
        await adminApi.createSource(token, { ...data, isActive: true });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="monitor-modal-overlay" onClick={onClose}>
      <div className="monitor-modal" onClick={e => e.stopPropagation()}>
        <h2 className="monitor-modal__title">{source ? 'Редактировать источник' : 'Добавить источник'}</h2>
        <form className="monitor-modal__form" onSubmit={handleSubmit}>
          <label className="monitor-modal__label">
            Тип источника
            <select className="monitor-modal__select" value={form.sourceType} onChange={e => {
              const t = e.target.value as FormData['sourceType'];
              set('sourceType', t);
              if (t === 'youtube' && !form.rssUrl) {
                set('url', 'https://www.youtube.com/@');
              }
            }}>
              <option value="rss">RSS</option>
              <option value="youtube">YouTube</option>
              <option value="telegram">Telegram</option>
            </select>
          </label>
          {form.sourceType === 'youtube' && (
            <p className="monitor-modal__hint">
              RSS URL: <code>https://www.youtube.com/feeds/videos.xml?channel_id=UC...</code>
            </p>
          )}
          <label className="monitor-modal__label">
            Название
            <input className="monitor-modal__input" value={form.name} onChange={e => set('name', e.target.value)} required />
          </label>
          <label className="monitor-modal__label">
            Сайт (URL)
            <input className="monitor-modal__input" value={form.url} onChange={e => set('url', e.target.value)} required />
          </label>
          <label className="monitor-modal__label">
            RSS URL
            <input className="monitor-modal__input" value={form.rssUrl} onChange={e => set('rssUrl', e.target.value)} required />
          </label>
          <div className="monitor-modal__row">
            <label className="monitor-modal__label">
              Регион
              <select className="monitor-modal__select" value={form.region} onChange={e => set('region', e.target.value)}>
                {NEWS_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="monitor-modal__label">
              Категория
              <select className="monitor-modal__select" value={form.category} onChange={e => set('category', e.target.value)}>
                {NEWS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <label className="monitor-modal__label">
            Город (опционально)
            <input className="monitor-modal__input" value={form.city ?? ''} onChange={e => set('city', e.target.value)} />
          </label>
          {error && <p className="monitor-modal__error">{error}</p>}
          <div className="monitor-modal__actions">
            <button type="button" className="monitor-modal__btn monitor-modal__btn--cancel" onClick={onClose}>Отмена</button>
            <button type="submit" className="monitor-modal__btn monitor-modal__btn--save" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
