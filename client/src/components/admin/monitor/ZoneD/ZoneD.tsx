import React, { useEffect, useState, useCallback } from 'react';
import {
  adminApi,
  AnalyticsSummary, HourlyPoint, DailyPoint, PeakHour, TopArticle, TopSource,
} from '@/services/adminApi';
import { AnalyticsSummaryCards } from './AnalyticsSummaryCards';
import { AnalyticsHourlyChart } from './AnalyticsHourlyChart';
import { AnalyticsDailyChart } from './AnalyticsDailyChart';
import { AnalyticsPeakChart } from './AnalyticsPeakChart';
import { TopArticlesTable } from './TopArticlesTable';
import { TopSourcesTable } from './TopSourcesTable';
import { ReactionsTable } from './ReactionsTable';
import { WorldMapTable } from './WorldMapTable';
import { TopCitiesTable } from './TopCitiesTable';
import { DevicesChart } from './DevicesChart';
import { TopPagesTable } from './TopPagesTable';

import { Icon } from '@/ui-system/icons/components';

interface Props { token: string; }

interface ReactionRow { articleId: number; title: string; likes: number; dislikes: number; emotions: Record<string, number>; }
interface ReactionsSummary { likes: number; dislikes: number; top: ReactionRow[]; }

const ZoneD: React.FC<Props> = ({ token }) => {
  const [summary, setSummary]         = useState<AnalyticsSummary | null>(null);
  const [hourly, setHourly]           = useState<HourlyPoint[]>([]);
  const [daily, setDaily]             = useState<DailyPoint[]>([]);
  const [peak, setPeak]               = useState<PeakHour[]>([]);
  const [topArticles, setTopArticles] = useState<TopArticle[]>([]);
  const [topSources, setTopSources]   = useState<TopSource[]>([]);
  const [reactions, setReactions]     = useState<ReactionsSummary>({
    likes: 0,
    dislikes: 0,
    top: [],
  });
  const [reactionsHours, setReactionsHours] = useState(24);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [clearingAnalytics, setClearingAnalytics] = useState(false);

  const fetchReactions = useCallback(async (hours: number) => {
    try {
      const r = await adminApi.getAnalyticsReactions(token, hours);
      setReactions({ likes: r.likes, dislikes: r.dislikes, top: r.top });
    } catch (err) {
      console.error('Failed to fetch reactions:', err);
    }
  }, [token]);

  const fetchAll = useCallback(() => {
    Promise.all([
      adminApi.getAnalyticsSummary(token, 24),
      adminApi.getAnalyticsHourly(token, 24),
      adminApi.getAnalyticsDaily(token, 30),
      adminApi.getAnalyticsPeak(token, 7),
      adminApi.getTopArticles(token, 24, 20),
      adminApi.getTopSources(token, 24),
      adminApi.getAnalyticsReactions(token, reactionsHours),
    ]).then(([s, h, d, p, ta, ts, r]) => {
      setSummary({ pageviews: s.pageviews, clicks: s.clicks, uniques: s.uniques });
      setHourly(h.data);
      setDaily(d.data);
      setPeak(p.data);
      setTopArticles(ta.data);
      setTopSources(ts.data);
      setReactions({ likes: r.likes, dislikes: r.dislikes, top: r.top });
      setLoading(false);
    }).catch(err => {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      setLoading(false);
    });
  }, [token, reactionsHours]);

  const handleReactionsPeriodChange = useCallback((hours: number) => {
    setReactionsHours(hours);
    fetchReactions(hours);
  }, [fetchReactions]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 60_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const scrollToGeography = () => {
    document.getElementById('geography-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleClearAnalytics = async () => {
    if (!confirm('Удалить ВСЕ данные аналитики (посещения, клики, география, устройства)? Это действие необратимо!')) {
      return;
    }

    setClearingAnalytics(true);
    try {
      const response = await fetch('/api/admin/analytics/all', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to clear analytics');

      const result = await response.json();
      alert(`Удалено ${result.deletedRows} записей аналитики`);
      fetchAll();
    } catch (err) {
      alert('Ошибка при очистке аналитики');
      console.error(err);
    } finally {
      setClearingAnalytics(false);
    }
  };

  return (
    <div className="monitor-section">
      <div className="monitor-section__header">
        <div className="monitor-section__actions">
          <button 
            onClick={scrollToGeography} 
            className="btn btn--secondary btn--sm"
            title="Перейти к географии"
          >
            🌍 География
          </button>
          <button 
            onClick={handleClearAnalytics}
            disabled={clearingAnalytics}
            className="btn btn--danger btn--sm"
            title="Удалить все данные аналитики"
          >
            {clearingAnalytics ? '⏳ Очистка...' : '🗑️ Очистить аналитику'}
          </button>
        </div>
      </div>

      {error && <p className="monitor-modal__error">{error}</p>}

      {loading ? (
        <div className="monitor-card"><p className="monitor-chart__empty">Загрузка...</p></div>
      ) : (
        <>
          <AnalyticsSummaryCards summary={summary} />
          <div className="monitor-grid monitor-grid--2">
            <AnalyticsHourlyChart data={hourly} />
            <AnalyticsDailyChart data={daily} />
          </div>
          <AnalyticsPeakChart data={peak} />
          <div className="monitor-grid monitor-grid--2">
            <TopArticlesTable data={topArticles} token={token} onReload={fetchAll} />
            <TopSourcesTable data={topSources} token={token} onReload={fetchAll} />
          </div>
          <ReactionsTable
            token={token}
            likes={reactions.likes}
            dislikes={reactions.dislikes}
            top={reactions.top}
            hours={reactionsHours}
            onReload={fetchAll}
            onPeriodChange={handleReactionsPeriodChange}
          />

          {/* Новые виджеты */}
          <div id="geography-section" className="monitor-section__geography">
            <h3 className="monitor-section__subtitle">
              <Icon name="location" size={18} /> География посетителей (7 дней)
            </h3>
            <WorldMapTable token={token} />
          </div>

          <div className="monitor-grid monitor-grid--2">
            <div className="monitor-card">
              <h3 className="monitor-card__title">
                <Icon name="location" size={16} /> Топ городов (7 дней)
              </h3>
              <TopCitiesTable token={token} />
            </div>
            <div className="monitor-card">
              <h3 className="monitor-card__title">
                <Icon name="smartphone" size={16} /> Устройства (24 часа)
              </h3>
              <DevicesChart token={token} />
            </div>
          </div>

          <div className="monitor-card">
            <h3 className="monitor-card__title">
              <Icon name="file" size={16} /> Топ страниц (24 часа)
            </h3>
            <TopPagesTable token={token} />
          </div>
        </>
      )}
    </div>
  );
};

export default ZoneD;
