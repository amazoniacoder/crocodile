import React, { useState, useEffect } from 'react';
import { Card } from '../../ui-system/components/card';
import { Button } from '../../ui-system/components/button';
import { Badge } from '../../ui-system/components/feedback';
import './SlaMonitor.css';

interface SlaMetrics {
  endpoint: string;
  method: string;
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  averageResponseTime: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  throughput: number;
  availability: number;
  lastUpdated: Date;
}

interface SlaViolation {
  id: string;
  endpoint: string;
  method: string;
  violationType: 'response_time' | 'error_rate' | 'availability';
  threshold: number;
  actualValue: number;
  timestamp: Date;
  resolved: boolean;
}

interface SlaSummary {
  totalEndpoints: number;
  healthyEndpoints: number;
  violatingEndpoints: number;
  totalViolations: number;
  activeViolations: number;
  averageResponseTime: number;
  overallAvailability: number;
  worstPerformingEndpoint: string | null;
}

export const SlaMonitor: React.FC<{ token: string }> = ({ token }) => {
  const [summary, setSummary] = useState<SlaSummary | null>(null);
  const [metrics, setMetrics] = useState<SlaMetrics[]>([]);
  const [violations, setViolations] = useState<SlaViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'violations'>('overview');

  const fetchData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      const [summaryRes, metricsRes, violationsRes] = await Promise.all([
        fetch('/api/admin/sla/summary', { headers }),
        fetch('/api/admin/sla/metrics', { headers }),
        fetch('/api/admin/sla/violations', { headers })
      ]);

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData.summary);
      }

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData.metrics);
      }

      if (violationsRes.ok) {
        const violationsData = await violationsRes.json();
        setViolations(violationsData.violations);
      }
    } catch (error) {
      console.error('Failed to fetch SLA data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (availability: number, errorRate: number, p95: number) => {
    if (availability >= 99 && errorRate <= 5 && p95 <= 500) {
      return <Badge variant="success">Healthy</Badge>;
    }
    if (availability >= 95 && errorRate <= 10 && p95 <= 1000) {
      return <Badge variant="warning">Warning</Badge>;
    }
    return <Badge variant="error">Critical</Badge>;
  };

  const getViolationBadge = (type: string) => {
    switch (type) {
      case 'response_time':
        return <Badge variant="warning">Response Time</Badge>;
      case 'error_rate':
        return <Badge variant="error">Error Rate</Badge>;
      case 'availability':
        return <Badge variant="error">Availability</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  if (loading) {
    return <div className="sla-monitor__loading">Loading SLA metrics...</div>;
  }

  return (
    <div className="sla-monitor">
      <div className="sla-monitor__header">
        <Button onClick={fetchData} variant="secondary" size="sm">
          Refresh
        </Button>
      </div>

      <div className="sla-monitor__tabs">
        <button
          className={`sla-monitor__tab ${activeTab === 'overview' ? 'sla-monitor__tab--active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`sla-monitor__tab ${activeTab === 'metrics' ? 'sla-monitor__tab--active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          Metrics
        </button>
        <button
          className={`sla-monitor__tab ${activeTab === 'violations' ? 'sla-monitor__tab--active' : ''}`}
          onClick={() => setActiveTab('violations')}
        >
          Violations ({violations.filter(v => !v.resolved).length})
        </button>
      </div>

      {activeTab === 'overview' && summary && (
        <div className="sla-monitor__overview">
          <div className="sla-monitor__summary-grid">
            <Card className="sla-monitor__summary-card">
              <h3>Endpoints</h3>
              <div className="sla-monitor__metric-value">{summary.totalEndpoints}</div>
              <div className="sla-monitor__metric-detail">
                {summary.healthyEndpoints} healthy, {summary.violatingEndpoints} issues
              </div>
            </Card>

            <Card className="sla-monitor__summary-card">
              <h3>Overall Availability</h3>
              <div className="sla-monitor__metric-value">{summary.overallAvailability}%</div>
              <div className="sla-monitor__metric-detail">
                {summary.overallAvailability >= 99 ? 'Excellent' : 
                 summary.overallAvailability >= 95 ? 'Good' : 'Poor'}
              </div>
            </Card>

            <Card className="sla-monitor__summary-card">
              <h3>Avg Response Time</h3>
              <div className="sla-monitor__metric-value">{summary.averageResponseTime}ms</div>
              <div className="sla-monitor__metric-detail">
                {summary.averageResponseTime <= 200 ? 'Fast' :
                 summary.averageResponseTime <= 500 ? 'Good' : 'Slow'}
              </div>
            </Card>

            <Card className="sla-monitor__summary-card">
              <h3>Active Violations</h3>
              <div className="sla-monitor__metric-value">{summary.activeViolations}</div>
              <div className="sla-monitor__metric-detail">
                {summary.totalViolations} total violations
              </div>
            </Card>
          </div>

          {summary.worstPerformingEndpoint && (
            <Card className="sla-monitor__worst-endpoint">
              <h3>Worst Performing Endpoint</h3>
              <code>{summary.worstPerformingEndpoint}</code>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'metrics' && (
        <div className="sla-monitor__metrics">
          <div className="sla-monitor__metrics-table">
            <table>
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Requests</th>
                  <th>Availability</th>
                  <th>Error Rate</th>
                  <th>Avg Response</th>
                  <th>P95</th>
                  <th>P99</th>
                  <th>Throughput</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric, index) => (
                  <tr key={index}>
                    <td><code>{metric.endpoint}</code></td>
                    <td><Badge variant="secondary">{metric.method}</Badge></td>
                    <td>{getStatusBadge(metric.availability, metric.errorRate, metric.p95)}</td>
                    <td>{metric.totalRequests.toLocaleString()}</td>
                    <td>{metric.availability}%</td>
                    <td>{metric.errorRate}%</td>
                    <td>{metric.averageResponseTime}ms</td>
                    <td>{metric.p95}ms</td>
                    <td>{metric.p99}ms</td>
                    <td>{metric.throughput}/min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'violations' && (
        <div className="sla-monitor__violations">
          {violations.length === 0 ? (
            <Card>
              <p>No SLA violations found. All endpoints are performing within thresholds.</p>
            </Card>
          ) : (
            <div className="sla-monitor__violations-list">
              {violations.map((violation) => (
                <Card key={violation.id} className="sla-monitor__violation-card">
                  <div className="sla-monitor__violation-header">
                    <div>
                      <code>{violation.method} {violation.endpoint}</code>
                      {getViolationBadge(violation.violationType)}
                      {violation.resolved && <Badge variant="success">Resolved</Badge>}
                    </div>
                    <div className="sla-monitor__violation-time">
                      {new Date(violation.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="sla-monitor__violation-details">
                    <span>Threshold: {violation.threshold}</span>
                    <span>Actual: {violation.actualValue}</span>
                    <span>Violation: {((violation.actualValue / violation.threshold - 1) * 100).toFixed(1)}% over threshold</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};