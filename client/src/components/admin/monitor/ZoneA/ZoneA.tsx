import React, { useEffect, useState, useCallback } from 'react';
import { adminApi, SourceStat, ChartPoint, SystemMetrics } from '@/services/adminApi';
import { SourceHealthTable } from './SourceHealthTable';
import { ArticlesPerSourceChart } from './ArticlesPerSourceChart';
import { RegionPieChart } from './RegionPieChart';
import { OverviewStats } from './OverviewStats';
import { ActivityChart } from './ActivityChart';
import { RecentArticlesModal } from './RecentArticlesModal';
import { ErrorsModal } from './ErrorsModal';
import { useWebSocket } from '@/ui-system/hooks/useWebSocket';
import { Zone, ZoneATab } from '@/pages/admin-monitor';

import { Icon } from '@/ui-system/icons/components';

const TABS: { id: ZoneATab; label: React.ReactNode }[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'russia',   label: 'Россия' },
  { id: 'world',    label: 'Мир' },
  { id: 'errors',   label: <><Icon name="warning" size={14} /> Ошибки</> },
  { id: 'blocked',  label: <><Icon name="lock" size={14} /> Заблокированы</> },
];

const BLOCKED_MARKERS = ['Заблокировано', '503', 'Status code 503'];

function isBlocked(s: SourceStat) {
  return BLOCKED_MARKERS.some(m => s.lastError?.includes(m));
}

interface Props {
  token: string;
  activeTab: ZoneATab;
  onTabChange: (tab: ZoneATab) => void;
  onNavigate: (zone: Zone, tab?: ZoneATab) => void;
}

const ZoneA: React.FC<Props> = ({ token, activeTab, onTabChange, onNavigate }) => {
  const [stats, setStats]     = useState<SourceStat[]>([]);
  const [stats1h, setStats1h] = useState<SourceStat[]>([]);
  const [chart, setChart]     = useState<ChartPoint[]>([]);
  const [system, setSystem]   = useState<SystemMetrics | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showArticles, setShowArticles] = useState(false);
  const [showErrors, setShowErrors]     = useState(false);
  const [rssHubOnline, setRssHubOnline] = useState<boolean | null>(null);
  const { socket } = useWebSocket();

  const fetchSystem = useCallback(() => {
    adminApi.getSystem(token).then(setSystem).catch(() => {});
  }, [token]);

  const fetchAll = useCallback(() => {
    Promise.all([
      adminApi.getStats(token, 24),
      adminApi.getStats(token, 1),
      adminApi.getChart(token, 24),
      adminApi.getSystem(token),
    ]).then(([s, s1h, c, sys]) => {
      setStats(s.stats);
      setStats1h(s1h.stats);
      setChart(c.data);
      setSystem(sys);
      setLoading(false);
    }).catch(err => {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      setLoading(false);
    });
  }, [token]);

  // Основной polling 30 сек
  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // Быстрый polling system каждые 2 сек всегда — для актуального статуса коллектора
  useEffect(() => {
    const id = setInterval(fetchSystem, 2_000);
    return () => clearInterval(id);
  }, [fetchSystem]);

  useEffect(() => {
    const checkRssHub = () => {
      adminApi.getRssHub(token).then(r => setRssHubOnline(r.online)).catch(() => setRssHubOnline(false));
    };
    checkRssHub();
    const id = setInterval(checkRssHub, 30_000);
    return () => clearInterval(id);
  }, [token]);

  useEffect(() => {
    socket.subscribe('news_updated', fetchAll);
    return () => socket.unsubscribe('news_updated', fetchAll);
  }, [socket, fetchAll]);

  const errorSources   = stats.filter(s => s.isActive && s.errorCount > 0);
  const blockedSources = stats.filter(isBlocked);

  const filtered =
    activeTab === 'overview' ? stats
    : activeTab === 'errors'  ? errorSources
    : activeTab === 'blocked' ? blockedSources
    : stats.filter(s => s.region === activeTab);

  const anomalous = stats.filter(s => s.isActive && (s.errorCount > 0 || s.totalInserted === 0)).length;

  const tabCount = (t: ZoneATab) => {
    if (t === 'overview') return stats.length;
    if (t === 'errors')   return errorSources.length;
    if (t === 'blocked')  return blockedSources.length;
    return stats.filter(s => s.region === t).length;
  };

  return (
    <div className="monitor-section">
      <div className="monitor-zone-header">
        {anomalous > 0 && (
          <span className="monitor-badge monitor-badge--error monitor-section__badge">
            {anomalous} аномальных
          </span>
        )}
        {rssHubOnline !== null && (
          <span className={`monitor-rsshub-badge${rssHubOnline ? ' monitor-rsshub-badge--on' : ' monitor-rsshub-badge--off'}`}>
            <span className="monitor-rsshub-badge__dot" />
            RSSHub
          </span>
        )}
        <div className="monitor-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`monitor-tab${activeTab === t.id ? ' monitor-tab--active' : ''}${(t.id === 'errors' || t.id === 'blocked') && tabCount(t.id) > 0 ? ' monitor-tab--errors' : ''}`}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
              <span className="monitor-tab__count">{tabCount(t.id)}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="monitor-modal__error">{error}</p>}

      {loading ? (
        <div className="monitor-card"><p className="monitor-chart__empty">Загрузка...</p></div>
      ) : activeTab === 'overview' ? (
        <>
          <OverviewStats
            stats={stats1h}
            lastCycleAt={system?.collector.lastCycleAt ?? null}
            isRunning={system?.collector.isRunning ?? false}
            lastCycleDurationMs={system?.collector.lastCycleDurationMs ?? null}
            nextCycleAt={system?.collector.nextCycleAt ?? null}
            nextFastCycleAt={system?.collector.nextFastCycleAt ?? null}
            nextSlowCycleAt={system?.collector.nextSlowCycleAt ?? null}
            onNavigate={onNavigate}
            onOpenArticles={() => setShowArticles(true)}
            onOpenErrors={() => setShowErrors(true)}
          />
          <div className="monitor-overview-row">
            <RegionPieChart stats={stats} />
            <ActivityChart data={chart} />
          </div>
        </>
      ) : (
        <>
          {activeTab !== 'errors' && activeTab !== 'blocked' && <ArticlesPerSourceChart stats={filtered} />}
          <SourceHealthTable
            stats={filtered}
            token={token}
            onRefresh={fetchAll}
            title={
              activeTab === 'blocked' ? 'Заблокированные источники — отключите ненужные' :
              activeTab === 'errors'  ? 'Источники с ошибками' :
              'Здоровье источников (24ч)'
            }
          />
        </>
      )}

      {showArticles && <RecentArticlesModal token={token} onClose={() => setShowArticles(false)} />}
      {showErrors   && <ErrorsModal stats={stats1h} onClose={() => setShowErrors(false)} />}
    </div>
  );
};

export default ZoneA;
