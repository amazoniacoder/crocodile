import React, { useState, useEffect } from 'react';
import { adminUserTokensApi, type TokenStats } from '@/services/adminUserTokensApi';
import { Icon } from '@/ui-system/icons/components';

interface StatsTabProps {
  token: string;
}

interface Subscription {
  id: number;
  name: string;
  sourceType: string;
}

interface TokenWithDetails {
  id: number;
  label: string | null;
  isActive: boolean;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  subscriptions: Subscription[];
}

type ChannelTab = 'all' | 'telegram' | 'youtube';

const TG_COLOR = '#229ED9';
const YT_COLOR = '#FF0000';

const ChannelBadge: React.FC<{ sub: Subscription }> = ({ sub }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 'var(--radius-full)',
      fontSize: 'var(--font-size-xs)',
      fontWeight: 'var(--font-medium)',
      background: sub.sourceType === 'telegram'
        ? 'color-mix(in oklab, #229ED9 12%, transparent)'
        : 'color-mix(in oklab, #FF0000 10%, transparent)',
      color: sub.sourceType === 'telegram' ? TG_COLOR : YT_COLOR,
      border: `1px solid ${sub.sourceType === 'telegram'
        ? 'color-mix(in oklab, #229ED9 25%, transparent)'
        : 'color-mix(in oklab, #FF0000 20%, transparent)'}`,
    }}
  >
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      {sub.sourceType === 'telegram' ? (
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.7 8.02c-.12.56-.46.7-.93.43l-2.57-1.89-1.24 1.19c-.14.14-.25.25-.51.25l.18-2.6 4.72-4.26c.2-.18-.05-.28-.32-.1L7.4 14.53l-2.52-.79c-.55-.17-.56-.55.12-.81l9.85-3.8c.46-.17.86.11.79.67z"/>
      ) : (
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/>
      )}
    </svg>
    {sub.name}
  </span>
);

const getActivityBadge = (lastUsedAt: string | null) => {
  if (!lastUsedAt) return { label: 'Никогда', cls: 'monitor-badge--off' };
  const days = Math.floor((Date.now() - new Date(lastUsedAt).getTime()) / 86400000);
  if (days < 7)  return { label: `${days}д назад`, cls: 'monitor-badge--ok' };
  if (days < 30) return { label: `${days}д назад`, cls: 'monitor-badge--warn' };
  return { label: `${days}д назад`, cls: 'monitor-badge--error' };
};

export const StatsTab: React.FC<StatsTabProps> = ({ token }) => {
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [tokens, setTokens] = useState<TokenWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelTab, setChannelTab] = useState<ChannelTab>('all');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    Promise.all([
      adminUserTokensApi.getStats(token),
      fetch('/api/admin/user-tokens/details', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
    ])
      .then(([statsData, detailsData]) => {
        setStats(statsData);
        setTokens(detailsData?.tokens ?? []);
      })
      .catch((error) => console.error('Failed to fetch stats:', error))
      .finally(() => setLoading(false));
  }, [token]);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) return <div className="zone-n__loading">Загрузка...</div>;
  if (!stats) return <div className="zone-n__error">Ошибка загрузки статистики</div>;

  const now = Date.now();
  const expiringTokens = tokens.filter(t => {
    if (!t.expiresAt || !t.isActive) return false;
    const ms = new Date(t.expiresAt).getTime() - now;
    return ms > 0 && ms <= 7 * 86400000;
  });

  const tgCount = tokens.reduce((n, t) => n + t.subscriptions.filter(s => s.sourceType === 'telegram').length, 0);
  const ytCount = tokens.reduce((n, t) => n + t.subscriptions.filter(s => s.sourceType === 'youtube').length, 0);

  const filteredTokens = tokens.map(t => ({
    ...t,
    subscriptions: channelTab === 'all'
      ? t.subscriptions
      : t.subscriptions.filter(s => s.sourceType === channelTab),
  })).filter(t => channelTab === 'all' || t.subscriptions.length > 0);

  return (
    <div className="zone-n__stats">
      {/* Stat cards */}
      <div className="zone-n__stats-grid">
        <div className="zone-n__stat-card">
          <div className="zone-n__stat-value">{stats.activeTokens}</div>
          <div className="zone-n__stat-label">Активных токенов</div>
        </div>
        <div className="zone-n__stat-card">
          <div className="zone-n__stat-value">{stats.totalTokens}</div>
          <div className="zone-n__stat-label">Всего токенов</div>
        </div>
        <div className="zone-n__stat-card">
          <div className="zone-n__stat-value">{stats.totalSubscriptions}</div>
          <div className="zone-n__stat-label">Всего подписок</div>
        </div>
        <div className="zone-n__stat-card">
          <div className="zone-n__stat-value">
            {stats.totalTokens > 0
              ? (stats.totalSubscriptions / stats.totalTokens).toFixed(1)
              : '0'}
          </div>
          <div className="zone-n__stat-label">Среднее каналов на токен</div>
        </div>
        <div className="zone-n__stat-card" style={expiringTokens.length > 0 ? { borderColor: 'var(--color-warning)' } : undefined}>
          <div className="zone-n__stat-value" style={{ color: expiringTokens.length > 0 ? 'var(--color-warning)' : undefined }}>
            {expiringTokens.length}
          </div>
          <div className="zone-n__stat-label">Истекают за 7 дней</div>
        </div>
      </div>

      {/* Expiry warning banner */}
      {expiringTokens.length > 0 && (
        <div style={{
          padding: 'var(--space-md)',
          background: 'color-mix(in oklab, var(--color-warning) 10%, transparent)',
          border: '1px solid color-mix(in oklab, var(--color-warning) 30%, transparent)',
          borderRadius: 'var(--radius-md)',
          marginTop: 'var(--space-md)',
        }}>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-warning)', marginBottom: 'var(--space-xs)' }}>
            ⚠️ Истекают в ближайшие 7 дней:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
            {expiringTokens.map(t => {
              const daysLeft = Math.ceil((new Date(t.expiresAt!).getTime() - now) / 86400000);
              return (
                <span key={t.id} className="monitor-badge monitor-badge--warn">
                  {t.label || `#${t.id}`} — {daysLeft} дн.
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Details table */}
      <div className="monitor-card" style={{ marginTop: 'var(--space-xl)' }}>
        <div className="monitor-card__header">
          <h3 className="monitor-card__title">Детализация подписок</h3>

          {/* Channel type tabs */}
          <div className="monitor-tabs">
            <button
              className={`monitor-tab${channelTab === 'all' ? ' monitor-tab--active' : ''}`}
              onClick={() => setChannelTab('all')}
            >
              Все
              <span className="monitor-tab__count">{stats.totalSubscriptions}</span>
            </button>
            <button
              className={`monitor-tab${channelTab === 'telegram' ? ' monitor-tab--active' : ''}`}
              onClick={() => setChannelTab('telegram')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill={channelTab === 'telegram' ? TG_COLOR : 'currentColor'}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.7 8.02c-.12.56-.46.7-.93.43l-2.57-1.89-1.24 1.19c-.14.14-.25.25-.51.25l.18-2.6 4.72-4.26c.2-.18-.05-.28-.32-.1L7.4 14.53l-2.52-.79c-.55-.17-.56-.55.12-.81l9.85-3.8c.46-.17.86.11.79.67z"/>
              </svg>
              Telegram
              <span className="monitor-tab__count">{tgCount}</span>
            </button>
            <button
              className={`monitor-tab${channelTab === 'youtube' ? ' monitor-tab--active' : ''}`}
              onClick={() => setChannelTab('youtube')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill={channelTab === 'youtube' ? YT_COLOR : 'currentColor'}>
                <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/>
              </svg>
              YouTube
              <span className="monitor-tab__count">{ytCount}</span>
            </button>
          </div>
        </div>

        <div className="monitor-table-wrap">
          <table className="monitor-table">
            <thead>
              <tr>
                <th style={{ width: 32 }} />
                <th>ID</th>
                <th>Метка</th>
                <th>Статус</th>
                <th>Активность</th>
                <th>Последний вход</th>
                <th style={{ textAlign: 'center' }}>
                  {channelTab === 'telegram' ? 'TG' : channelTab === 'youtube' ? 'YT' : 'Подписок'}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTokens.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-xl)' }}>
                    Нет данных
                  </td>
                </tr>
              )}
              {filteredTokens.map((t) => {
                const isExpanded = expandedIds.has(t.id);
                const hasSubs = t.subscriptions.length > 0;
                return (
                  <React.Fragment key={t.id}>
                    <tr
                      style={{ cursor: hasSubs ? 'pointer' : 'default' }}
                      onClick={() => hasSubs && toggleExpand(t.id)}
                    >
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        {hasSubs && (
                          <Icon name={isExpanded ? 'arrow-down' : 'arrow-right'} size={14} />
                        )}
                      </td>
                      <td>
                        <code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          #{t.id}
                        </code>
                      </td>
                      <td className="monitor-table__name">{t.label || '—'}</td>
                      <td>
                        <span className={`monitor-badge monitor-badge--${t.isActive ? 'ok' : 'off'}`}>
                          {t.isActive ? 'Активен' : 'Неактивен'}
                        </span>
                      </td>
                      <td>
                        {(() => { const a = getActivityBadge(t.lastUsedAt); return <span className={`monitor-badge ${a.cls}`}>{a.label}</span>; })()}
                      </td>
                      <td className="monitor-table__muted">
                        {t.lastUsedAt
                          ? new Date(t.lastUsedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {hasSubs ? (
                          <span className="monitor-badge monitor-badge--blue">{t.subscriptions.length}</span>
                        ) : (
                          <span className="monitor-table__muted">0</span>
                        )}
                      </td>
                    </tr>

                    {isExpanded && hasSubs && (
                      <tr>
                        <td colSpan={7} style={{ padding: '0 var(--space-md) var(--space-md)', background: 'var(--bg-secondary)' }}>
                          {/* Sub-tabs inside expanded row */}
                          {channelTab === 'all' && (() => {
                            const tg = t.subscriptions.filter(s => s.sourceType === 'telegram');
                            const yt = t.subscriptions.filter(s => s.sourceType === 'youtube');
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', paddingTop: 'var(--space-sm)' }}>
                                {tg.length > 0 && (
                                  <div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-semibold)', color: TG_COLOR, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.7 8.02c-.12.56-.46.7-.93.43l-2.57-1.89-1.24 1.19c-.14.14-.25.25-.51.25l.18-2.6 4.72-4.26c.2-.18-.05-.28-.32-.1L7.4 14.53l-2.52-.79c-.55-.17-.56-.55.12-.81l9.85-3.8c.46-.17.86.11.79.67z"/></svg>
                                      Telegram ({tg.length})
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                      {tg.map(s => <ChannelBadge key={s.id} sub={s} />)}
                                    </div>
                                  </div>
                                )}
                                {yt.length > 0 && (
                                  <div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-semibold)', color: YT_COLOR, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/></svg>
                                      YouTube ({yt.length})
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                      {yt.map(s => <ChannelBadge key={s.id} sub={s} />)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {channelTab !== 'all' && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 'var(--space-sm)' }}>
                              {t.subscriptions.map(s => <ChannelBadge key={s.id} sub={s} />)}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
