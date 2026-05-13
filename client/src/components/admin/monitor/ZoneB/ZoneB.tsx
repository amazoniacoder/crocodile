import React, { useEffect, useState, useCallback } from 'react';
import { adminApi, SystemMetrics as TSystemMetrics, TimingPoint, PushStats } from '@/services/adminApi';
import { SystemMetrics } from './SystemMetrics';
import { CollectionTimingChart } from './CollectionTimingChart';
import { Icon } from '@/ui-system/icons/components';

interface Props {
  token: string;
}

const ZoneB: React.FC<Props> = ({ token }) => {
  const [system, setSystem]     = useState<TSystemMetrics | null>(null);
  const [timing, setTiming]     = useState<TimingPoint[]>([]);
  const [pushStats, setPushStats] = useState<PushStats | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [loadingSystem, setLoadingSystem] = useState(true);

  const fetchSystem = useCallback(() => {
    adminApi.getSystem(token)
      .then(data => { setSystem(data); setLoadingSystem(false); })
      .catch(err => { setError(err instanceof Error ? err.message : 'Ошибка'); setLoadingSystem(false); });
  }, [token]);

  const fetchTiming = useCallback(() => {
    adminApi.getTiming(token).then(res => setTiming(res.timing)).catch(() => {});
  }, [token]);

  const fetchPush = useCallback(() => {
    adminApi.getPushStats(token).then(r => setPushStats(r)).catch(() => {});
  }, [token]);

  useEffect(() => {
    fetchSystem();
    fetchTiming();
    fetchPush();

    const sysId    = setInterval(fetchSystem,  5_000);
    const timingId = setInterval(fetchTiming, 30_000);
    const pushId   = setInterval(fetchPush,   60_000);
    return () => { clearInterval(sysId); clearInterval(timingId); clearInterval(pushId); };
  }, [fetchSystem, fetchTiming, fetchPush]);

  return (
    <div className="monitor-section">
      {error && <p className="monitor-modal__error">{error}</p>}
      {loadingSystem
        ? <div className="monitor-card"><p className="monitor-chart__empty">Загрузка метрик...</p></div>
        : system && <SystemMetrics data={system} />
      }
      {pushStats && (
        <div className="monitor-card">
          <h3 className="monitor-card__title"><Icon name="bell" size={16} /> Web Push</h3>
          <div className="monitor-grid">
            <div className="monitor-stat">
              <div className="monitor-stat__label">Статус</div>
              <div className="monitor-stat__value">
                <span className={`monitor-badge ${pushStats.enabled ? 'monitor-badge--green' : 'monitor-badge--red'}`}>
                  {pushStats.enabled ? 'Активен' : 'Не настроен'}
                </span>
              </div>
              <div className="monitor-stat__sub">VAPID {pushStats.enabled ? 'сконфигурирован' : 'не задан'}</div>
            </div>
            <div className="monitor-stat">
              <div className="monitor-stat__label">Подписок</div>
              <div className="monitor-stat__value">{pushStats.subscriptions}</div>
              <div className="monitor-stat__sub">порог рассылки: {pushStats.threshold} статей</div>
            </div>
          </div>
        </div>
      )}
      <CollectionTimingChart data={timing} />
    </div>
  );
};

export default ZoneB;
