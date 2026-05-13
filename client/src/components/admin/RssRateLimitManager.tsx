import React, { useState, useEffect } from 'react';
import { Icon } from '@/ui-system/icons/components';

interface RateLimitStats {
  domain: string;
  requestsPerMinute: number;
  hourlyRequests: number;
  consecutiveErrors: number;
  isBackedOff: boolean;
  backoffRemaining?: number;
  lastRequest?: string;
  lastError?: string;
}

interface RateLimitSummary {
  totalDomains: number;
  activeDomains: number;
  backedOffDomains: number;
  domainsWithErrors: number;
  totalRequestsThisMinute: number;
  totalRequestsThisHour: number;
  averageErrorRate: number;
}

interface Props { adminToken: string; }

const RssRateLimitManager: React.FC<Props> = ({ adminToken }) => {
  const [stats, setStats]           = useState<RateLimitStats[]>([]);
  const [summary, setSummary]       = useState<RateLimitSummary | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [testDomain, setTestDomain] = useState('');
  const [testRequests, setTestRequests] = useState(1);
  const [testResults, setTestResults]   = useState<any>(null);
  const [isTestRunning, setIsTestRunning] = useState(false);

  const fetchData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${adminToken}` };
      const [statsRes, summaryRes] = await Promise.all([
        fetch('/api/admin/rss/rate-limits', { headers }),
        fetch('/api/admin/rss/rate-limits/summary', { headers }),
      ]);
      if (statsRes.ok && summaryRes.ok) {
        setStats((await statsRes.json()).rateLimits);
        setSummary((await summaryRes.json()).summary);
        setError(null);
      } else {
        setError('Не удалось загрузить данные');
      }
    } catch {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  const resetDomain = async (domain: string) => {
    if (!confirm(`Сбросить лимиты для ${domain}?`)) return;
    const res = await fetch(`/api/admin/rss/rate-limits/${encodeURIComponent(domain)}/reset`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    if (res.ok) fetchData();
  };

  const runTest = async () => {
    if (!testDomain) return;
    setIsTestRunning(true);
    setTestResults(null);
    try {
      const res = await fetch('/api/admin/rss/rate-limits/test', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: testDomain, requests: testRequests }),
      });
      if (res.ok) { setTestResults(await res.json()); fetchData(); }
    } finally {
      setIsTestRunning(false);
    }
  };

  const getStatusColor = (s: RateLimitStats) =>
    s.isBackedOff ? '#ef4444' : s.consecutiveErrors > 0 ? '#f59e0b' : s.requestsPerMinute > 0 ? '#22c55e' : '#6b7280';

  const getStatusText = (s: RateLimitStats) =>
    s.isBackedOff ? `Backoff (${s.backoffRemaining}с)` : s.consecutiveErrors > 0 ? `${s.consecutiveErrors} ошибок` : s.requestsPerMinute > 0 ? 'Активен' : 'Простой';

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [adminToken]);

  if (loading) return <div className="rate-limit-manager"><div className="rate-limit-manager__loading">Загрузка...</div></div>;
  if (error)   return <div className="rate-limit-manager"><div className="rate-limit-manager__error">{error}</div><button onClick={fetchData} className="button button--secondary">Повторить</button></div>;

  return (
    <div className="rate-limit-manager">
      <div className="rate-limit-manager__header">
        <h2><Icon name="status" size={20} /> RSS Rate Limiting</h2>
        <button onClick={fetchData} className="button button--secondary">
          <Icon name="refresh" size={16} /> Обновить
        </button>
      </div>

      {summary && (
        <div className="rate-limit-summary">
          <div className="summary-card"><div className="summary-card__title">Доменов</div><div className="summary-card__value">{summary.totalDomains}</div></div>
          <div className="summary-card summary-card--success"><div className="summary-card__title">Активных</div><div className="summary-card__value">{summary.activeDomains}</div></div>
          <div className="summary-card summary-card--error"><div className="summary-card__title">Backoff</div><div className="summary-card__value">{summary.backedOffDomains}</div></div>
          <div className="summary-card summary-card--warning"><div className="summary-card__title">С ошибками</div><div className="summary-card__value">{summary.domainsWithErrors}</div></div>
          <div className="summary-card"><div className="summary-card__title">Запросов/час</div><div className="summary-card__value">{summary.totalRequestsThisHour}</div></div>
        </div>
      )}

      <div className="rate-limit-testing">
        <h3><Icon name="flask" size={16} /> Тестирование лимитов</h3>
        <div className="testing-form">
          <div className="form-group">
            <label>Домен:</label>
            <input type="text" value={testDomain} onChange={e => setTestDomain(e.target.value)} placeholder="example.com" className="input" />
          </div>
          <div className="form-group">
            <label>Запросов:</label>
            <input type="number" value={testRequests} onChange={e => setTestRequests(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))} min="1" max="10" className="input input--small" />
          </div>
          <button onClick={runTest} disabled={isTestRunning || !testDomain} className="button button--primary">
            {isTestRunning ? <><Icon name="refresh" size={14} /> Тест...</> : <><Icon name="flask" size={14} /> Запустить</>}
          </button>
        </div>

        {testResults && (
          <div className="test-results">
            <h4>Результаты для {testResults.domain}</h4>
            <div className="test-results-grid">
              {testResults.results.map((result: any, i: number) => (
                <div key={i} className={`test-result ${result.allowed ? 'test-result--success' : 'test-result--blocked'}`}>
                  <div className="test-result__header">
                    <span>Запрос {result.request}</span>
                    <span className={result.allowed ? 'status--allowed' : 'status--blocked'}>
                      {result.allowed ? <><Icon name="check" size={14} /> Разрешён</> : <><Icon name="x" size={14} /> Заблокирован</>}
                    </span>
                  </div>
                  {result.reason && <div className="test-result__reason">{result.reason}</div>}
                  <div className="test-result__details">
                    Rate: {result.currentRate}/{result.limit}
                    {result.retryAfter && ` | Повтор через: ${result.retryAfter}с`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rate-limit-stats">
        <h3><Icon name="chart" size={16} /> Статистика доменов</h3>
        {stats.length === 0
          ? <div className="no-stats">Нет данных</div>
          : (
            <div className="stats-table">
              <div className="stats-table__header">
                <div>Домен</div><div>Статус</div><div>Запр/мин</div><div>Запр/час</div><div>Ошибки</div><div>Последний запрос</div><div>Действия</div>
              </div>
              {stats.map(stat => (
                <div key={stat.domain} className="stats-table__row">
                  <div className="domain-cell"><span className="domain-name">{stat.domain}</span></div>
                  <div className="status-cell"><span className="status-indicator" style={{ color: getStatusColor(stat) }}>{getStatusText(stat)}</span></div>
                  <div className="metric-cell"><span className={stat.requestsPerMinute > 0 ? 'metric--active' : ''}>{stat.requestsPerMinute}</span></div>
                  <div className="metric-cell"><span className={stat.hourlyRequests > 0 ? 'metric--active' : ''}>{stat.hourlyRequests}</span></div>
                  <div className="metric-cell"><span className={stat.consecutiveErrors > 0 ? 'metric--error' : ''}>{stat.consecutiveErrors}</span></div>
                  <div className="time-cell">{stat.lastRequest ? new Date(stat.lastRequest).toLocaleString('ru-RU') : 'Никогда'}</div>
                  <div className="actions-cell">
                    <button onClick={() => resetDomain(stat.domain)} className="button button--small button--danger" disabled={!stat.isBackedOff && stat.consecutiveErrors === 0}>
                      <Icon name="refresh" size={14} /> Сброс
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {stats.some(s => s.lastError) && (
        <div className="error-details">
          <h3><Icon name="error" size={16} /> Последние ошибки</h3>
          <div className="error-list">
            {stats.filter(s => s.lastError).map(stat => (
              <div key={stat.domain} className="error-item">
                <div className="error-item__domain">{stat.domain}</div>
                <div className="error-item__message">{stat.lastError}</div>
                <div className="error-item__count">{stat.consecutiveErrors} подряд</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RssRateLimitManager;
