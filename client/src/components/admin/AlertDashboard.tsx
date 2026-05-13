import React, { useState, useEffect } from 'react';
import { Icon } from '@/ui-system/icons/components';

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggeredAt: string;
  resolvedAt?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  cooldownMinutes: number;
  enabled: boolean;
}

interface AlertStats {
  activeAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  alertsLast24h: number;
  mostTriggeredRule: string | null;
  averageResolutionTime: number;
}

interface Props {
  adminToken: string;
}

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  critical: <Icon name="error"   size={18} />,
  warning:  <Icon name="warning" size={18} />,
  info:     <Icon name="info"    size={18} />,
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  warning:  '#f59e0b',
  info:     '#3b82f6',
};

const AlertDashboard: React.FC<Props> = ({ adminToken }) => {
  const [activeAlerts, setActiveAlerts]   = useState<Alert[]>([]);
  const [alertHistory, setAlertHistory]   = useState<Alert[]>([]);
  const [alertRules, setAlertRules]       = useState<AlertRule[]>([]);
  const [alertStats, setAlertStats]       = useState<AlertStats | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [selectedTab, setSelectedTab]     = useState<'active' | 'history' | 'rules'>('active');

  const fetchData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${adminToken}` };
      const [dashboardRes, historyRes, rulesRes] = await Promise.all([
        fetch('/api/admin/alerts/dashboard', { headers }),
        fetch('/api/admin/alerts/history?limit=50', { headers }),
        fetch('/api/admin/alerts/rules', { headers }),
      ]);
      if (dashboardRes.ok && historyRes.ok && rulesRes.ok) {
        const d = await dashboardRes.json();
        setActiveAlerts(d.dashboard.activeAlerts.list);
        setAlertStats(d.dashboard.statistics);
        setAlertHistory((await historyRes.json()).alerts);
        setAlertRules((await rulesRes.json()).rules);
        setError(null);
      } else {
        setError('Не удалось загрузить данные алертов');
      }
    } catch {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    const res = await fetch(`/api/admin/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ acknowledgedBy: 'admin' }),
    });
    if (res.ok) fetchData();
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    const res = await fetch(`/api/admin/alerts/rules/${ruleId}/toggle`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) fetchData();
  };

  const testAlert = async () => {
    const res = await fetch('/api/admin/alerts/test', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ severity: 'info', message: 'Test alert triggered from dashboard' }),
    });
    if (res.ok) setTimeout(fetchData, 1000);
  };

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
    if (h > 0) return `${h}ч ${m % 60}м`;
    if (m > 0) return `${m}м ${s % 60}с`;
    return `${s}с`;
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [adminToken]);

  if (loading) return <div className="alert-dashboard"><div className="alert-dashboard__loading">Загрузка...</div></div>;
  if (error)   return <div className="alert-dashboard"><div className="alert-dashboard__error">{error}</div><button onClick={fetchData} className="button button--secondary">Повторить</button></div>;

  return (
    <div className="alert-dashboard">
      <div className="alert-dashboard__header">
        <h2><Icon name="bell" size={20} /> Управление алертами</h2>
        <div className="alert-dashboard__actions">
          <button onClick={testAlert} className="button button--secondary">
            <Icon name="flask" size={16} /> Тест
          </button>
          <button onClick={fetchData} className="button button--secondary">
            <Icon name="refresh" size={16} /> Обновить
          </button>
        </div>
      </div>

      {alertStats && (
        <div className="alert-stats">
          <div className="stat-card">
            <div className="stat-card__title">Активных</div>
            <div className="stat-card__value">{alertStats.activeAlerts}</div>
          </div>
          <div className="stat-card stat-card--critical">
            <div className="stat-card__title">Критических</div>
            <div className="stat-card__value">{alertStats.criticalAlerts}</div>
          </div>
          <div className="stat-card stat-card--warning">
            <div className="stat-card__title">Предупреждений</div>
            <div className="stat-card__value">{alertStats.warningAlerts}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__title">За 24ч</div>
            <div className="stat-card__value">{alertStats.alertsLast24h}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__title">Среднее время</div>
            <div className="stat-card__value">{formatDuration(alertStats.averageResolutionTime * 1000)}</div>
          </div>
        </div>
      )}

      <div className="alert-tabs">
        {(['active', 'history', 'rules'] as const).map(tab => (
          <button key={tab} className={`alert-tab${selectedTab === tab ? ' alert-tab--active' : ''}`} onClick={() => setSelectedTab(tab)}>
            {tab === 'active' ? `Активные (${activeAlerts.length})` : tab === 'history' ? `История (${alertHistory.length})` : `Правила (${alertRules.length})`}
          </button>
        ))}
      </div>

      <div className="alert-content">
        {selectedTab === 'active' && (
          <div className="alert-list">
            {activeAlerts.length === 0
              ? <div className="no-alerts">Нет активных алертов</div>
              : activeAlerts.map(alert => (
                <div key={alert.id} className={`alert-item alert-item--${alert.severity}`}>
                  <div className="alert-item__header">
                    <span className="alert-item__icon">{SEVERITY_ICON[alert.severity] ?? <Icon name="info" size={18} />}</span>
                    <span className="alert-item__title">{alert.ruleName}</span>
                    <span className="alert-item__severity" style={{ color: SEVERITY_COLOR[alert.severity] }}>{alert.severity.toUpperCase()}</span>
                    <span className="alert-item__time">{new Date(alert.triggeredAt).toLocaleString('ru-RU')}</span>
                  </div>
                  <div className="alert-item__message">{alert.message}</div>
                  <div className="alert-item__actions">
                    {!alert.acknowledged
                      ? <button onClick={() => acknowledgeAlert(alert.id)} className="button button--small button--primary"><Icon name="check" size={14} /> Подтвердить</button>
                      : <span className="alert-item__acknowledged"><Icon name="check" size={14} /> Подтверждено: {alert.acknowledgedBy}</span>
                    }
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {selectedTab === 'history' && (
          <div className="alert-list">
            {alertHistory.map(alert => (
              <div key={alert.id} className={`alert-item alert-item--${alert.severity} alert-item--history`}>
                <div className="alert-item__header">
                  <span className="alert-item__icon">{SEVERITY_ICON[alert.severity] ?? <Icon name="info" size={18} />}</span>
                  <span className="alert-item__title">{alert.ruleName}</span>
                  <span className="alert-item__severity" style={{ color: SEVERITY_COLOR[alert.severity] }}>{alert.severity.toUpperCase()}</span>
                  <span className="alert-item__time">{new Date(alert.triggeredAt).toLocaleString('ru-RU')}</span>
                  {alert.resolvedAt && <span className="alert-item__resolved"><Icon name="check" size={14} /> Решено</span>}
                </div>
                <div className="alert-item__message">{alert.message}</div>
                {alert.resolvedAt && (
                  <div className="alert-item__duration">
                    Длительность: {formatDuration(new Date(alert.resolvedAt).getTime() - new Date(alert.triggeredAt).getTime())}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {selectedTab === 'rules' && (
          <div className="alert-rules">
            {alertRules.map(rule => (
              <div key={rule.id} className={`rule-item ${rule.enabled ? 'rule-item--enabled' : 'rule-item--disabled'}`}>
                <div className="rule-item__header">
                  <span className="rule-item__icon">{SEVERITY_ICON[rule.severity] ?? <Icon name="info" size={18} />}</span>
                  <span className="rule-item__name">{rule.name}</span>
                  <span className="rule-item__severity" style={{ color: SEVERITY_COLOR[rule.severity] }}>{rule.severity.toUpperCase()}</span>
                  <span className="rule-item__cooldown">Cooldown: {rule.cooldownMinutes}мин</span>
                </div>
                <div className="rule-item__description">{rule.description}</div>
                <div className="rule-item__actions">
                  <button onClick={() => toggleRule(rule.id, !rule.enabled)} className={`button button--small ${rule.enabled ? 'button--danger' : 'button--success'}`}>
                    {rule.enabled ? <><Icon name="x" size={14} /> Отключить</> : <><Icon name="check" size={14} /> Включить</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertDashboard;
