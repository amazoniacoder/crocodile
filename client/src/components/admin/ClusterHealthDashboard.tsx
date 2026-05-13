import React, { useState, useEffect } from 'react';
import { Icon } from '@/ui-system/icons/components';

interface NodeHealth {
  nodeId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  lastCheck: string;
  responseTime: number;
  metrics: { cpuUsage: number; memoryUsage: number; activeConnections: number; uptime: number };
  services: { database: boolean; redis: boolean; rss: boolean; websocket: boolean };
  errors: string[];
}

interface ClusterHealth {
  totalNodes: number;
  healthyNodes: number;
  degradedNodes: number;
  unhealthyNodes: number;
  nodes: NodeHealth[];
}

interface FailoverStatus {
  enabled: boolean;
  inProgress: boolean;
  failoverCount: number;
  lastFailover: string | null;
  policy: { enabled: boolean; maxFailoversPerHour: number; cooldownMinutes: number; requiredHealthyNodes: number; autoRecovery: boolean };
}

interface Props { adminToken: string; }

const STATUS_ICON: Record<string, React.ReactNode> = {
  healthy:   <Icon name="success" size={16} />,
  degraded:  <Icon name="warning" size={16} />,
  unhealthy: <Icon name="error"   size={16} />,
  offline:   <Icon name="circle"  size={16} />,
};

const STATUS_COLOR: Record<string, string> = {
  healthy: '#22c55e', degraded: '#f59e0b', unhealthy: '#ef4444', offline: '#6b7280',
};

const ServiceBadge: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <div className={`service ${ok ? 'service--ok' : 'service--error'}`}>
    {ok ? <Icon name="check" size={12} /> : <Icon name="x" size={12} />} {label}
  </div>
);

const ClusterHealthDashboard: React.FC<Props> = ({ adminToken }) => {
  const [health, setHealth]               = useState<ClusterHealth | null>(null);
  const [failoverStatus, setFailoverStatus] = useState<FailoverStatus | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [refreshing, setRefreshing]       = useState(false);

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const headers = { 'Authorization': `Bearer ${adminToken}` };
      const [healthRes, failoverRes] = await Promise.all([
        fetch('/api/admin/cluster/health-detailed', { headers }),
        fetch('/api/admin/cluster/failover-status', { headers }),
      ]);
      if (healthRes.ok && failoverRes.ok) {
        setHealth((await healthRes.json()).health);
        setFailoverStatus((await failoverRes.json()).failover);
        setError(null);
      } else {
        setError('Не удалось загрузить данные кластера');
      }
    } catch {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(() => fetchData(), 15000);
    return () => clearInterval(id);
  }, [adminToken]);

  if (loading) return <div className="cluster-health"><div className="cluster-health__loading">Загрузка...</div></div>;
  if (error)   return <div className="cluster-health"><div className="cluster-health__error">{error}</div><button onClick={() => fetchData(true)} className="button button--secondary">Повторить</button></div>;

  return (
    <div className="cluster-health">
      <div className="cluster-health__header">
        <button onClick={() => fetchData(true)} className="button button--secondary" disabled={refreshing}>
          <Icon name="refresh" size={16} /> {refreshing ? 'Обновление...' : 'Обновить'}
        </button>
      </div>

      <div className="cluster-health__overview">
        <div className="health-card"><div className="health-card__title">Всего нод</div><div className="health-card__value">{health?.totalNodes ?? 0}</div></div>
        <div className="health-card health-card--success"><div className="health-card__title">Здоровых</div><div className="health-card__value">{health?.healthyNodes ?? 0}</div></div>
        <div className="health-card health-card--warning"><div className="health-card__title">Деградация</div><div className="health-card__value">{health?.degradedNodes ?? 0}</div></div>
        <div className="health-card health-card--error"><div className="health-card__title">Нездоровых</div><div className="health-card__value">{health?.unhealthyNodes ?? 0}</div></div>
      </div>

      <div className="cluster-health__failover">
        <h3><Icon name="refresh" size={16} /> Статус failover</h3>
        <div className="failover-status">
          <div className="failover-status__item">
            <span>Включён:</span>
            <span className={failoverStatus?.enabled ? 'status--enabled' : 'status--disabled'}>
              {failoverStatus?.enabled ? <><Icon name="check" size={14} /> Да</> : <><Icon name="x" size={14} /> Нет</>}
            </span>
          </div>
          <div className="failover-status__item">
            <span>В процессе:</span>
            <span className={failoverStatus?.inProgress ? 'status--active' : 'status--inactive'}>
              {failoverStatus?.inProgress ? <><Icon name="refresh" size={14} /> Да</> : <><Icon name="check" size={14} /> Нет</>}
            </span>
          </div>
          <div className="failover-status__item">
            <span>Переключений за час:</span>
            <span>{failoverStatus?.failoverCount ?? 0}/{failoverStatus?.policy.maxFailoversPerHour ?? 0}</span>
          </div>
          <div className="failover-status__item">
            <span>Последнее:</span>
            <span>{failoverStatus?.lastFailover ? new Date(failoverStatus.lastFailover).toLocaleString('ru-RU') : 'Никогда'}</span>
          </div>
        </div>
      </div>

      <div className="cluster-health__nodes">
        <h3><Icon name="chart" size={16} /> Детали нод</h3>
        <div className="nodes-grid">
          {health?.nodes.map(node => (
            <div key={node.nodeId} className="node-card">
              <div className="node-card__header">
                <div className="node-card__status" style={{ color: STATUS_COLOR[node.status] ?? '#6b7280' }}>
                  {STATUS_ICON[node.status]} {node.status.toUpperCase()}
                </div>
                <div className="node-card__id">{node.nodeId}</div>
              </div>
              <div className="node-card__metrics">
                <div className="metric"><span>CPU:</span><span className={node.metrics.cpuUsage > 80 ? 'metric--high' : ''}>{node.metrics.cpuUsage.toFixed(1)}%</span></div>
                <div className="metric"><span>Память:</span><span className={node.metrics.memoryUsage > 1000 ? 'metric--high' : ''}>{node.metrics.memoryUsage.toFixed(0)}МБ</span></div>
                <div className="metric"><span>Соединений:</span><span>{node.metrics.activeConnections}</span></div>
                <div className="metric"><span>Uptime:</span><span>{Math.floor(node.metrics.uptime / 3600)}ч</span></div>
                <div className="metric"><span>Ответ:</span><span className={node.responseTime > 1000 ? 'metric--high' : ''}>{node.responseTime}мс</span></div>
              </div>
              <div className="node-card__services">
                <ServiceBadge ok={node.services.database} label="DB" />
                <ServiceBadge ok={node.services.redis}    label="Redis" />
                <ServiceBadge ok={node.services.rss}      label="RSS" />
                <ServiceBadge ok={node.services.websocket} label="WS" />
              </div>
              {node.errors.length > 0 && (
                <div className="node-card__errors">
                  <strong>Ошибки:</strong>
                  <ul>{node.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default ClusterHealthDashboard;
