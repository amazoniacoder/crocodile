import React, { useState } from 'react';
import { Icon } from '@/ui-system/icons/components';

interface TestResult {
  name: string;
  status: 'success' | 'warning' | 'error' | 'skipped';
  message: string;
  details?: any;
  duration?: number;
}

interface TestSuite {
  name: string;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
}

interface TestResponse {
  success: boolean;
  testSuite?: TestSuite;
  testSuites?: TestSuite[];
  overallSummary?: TestSuite['summary'];
  duration: number;
  timestamp: string;
  error?: string;
}

interface Props {
  adminToken: string;
}

const testTypes = [
  { id: 'health',         icon: 'server'     as const, name: 'Тесты здоровья',        description: 'Проверка мониторинга здоровья кластера и сервисов' },
  { id: 'failover',       icon: 'refresh'    as const, name: 'Тесты отказоустойчивости', description: 'Проверка автоматического переключения и восстановления' },
  { id: 'load-balancing', icon: 'chart'      as const, name: 'Тесты балансировки',     description: 'Проверка распределения нагрузки' },
  { id: 'comprehensive',  icon: 'flask'      as const, name: 'Полный прогон',          description: 'Запустить все тесты кластера (рекомендуется)' },
];

const STATUS_ICON: Record<string, React.ReactNode> = {
  success: <Icon name="success"  size={18} />,
  warning: <Icon name="warning"  size={18} />,
  error:   <Icon name="error"    size={18} />,
  skipped: <Icon name="minus"    size={18} />,
};

const STATUS_COLOR: Record<string, string> = {
  success: '#22c55e',
  warning: '#f59e0b',
  error:   '#ef4444',
  skipped: '#6b7280',
};

const STATUS_LABEL: Record<string, string> = {
  success: 'УСПЕХ',
  warning: 'ПРЕДУПРЕЖДЕНИЕ',
  error:   'ОШИБКА',
  skipped: 'ПРОПУЩЕН',
};

const ClusterTestRunner: React.FC<Props> = ({ adminToken }) => {
  const [testResults, setTestResults] = useState<TestResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTest, setSelectedTest] = useState<string>('');

  const runTest = async (testType: string) => {
    setIsRunning(true);
    setTestResults(null);
    setSelectedTest(testType);
    try {
      const response = await fetch(`/api/admin/cluster/test/${testType}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
      });
      setTestResults(await response.json());
    } catch (error) {
      setTestResults({ success: false, error: `Network error: ${error}`, duration: 0, timestamp: new Date().toISOString() });
    } finally {
      setIsRunning(false);
    }
  };

  const renderTestSuite = (suite: TestSuite, index: number = 0) => (
    <div key={`${suite.name}-${index}`} className="test-suite">
      <div className="test-suite__header">
        <h3 className="test-suite__title">{suite.name}</h3>
        <div className="test-suite__summary" style={{ color: suite.summary.failed > 0 ? '#ef4444' : suite.summary.warnings > 0 ? '#f59e0b' : '#22c55e' }}>
          {suite.summary.passed}/{suite.summary.total} пройдено
          {suite.summary.warnings > 0 && `, ${suite.summary.warnings} предупреждений`}
          {suite.summary.failed > 0 && `, ${suite.summary.failed} провалено`}
        </div>
      </div>
      <div className="test-results">
        {suite.results.map((result, idx) => (
          <div key={idx} className={`test-result test-result--${result.status}`}>
            <div className="test-result__header">
              <span className="test-result__icon">{STATUS_ICON[result.status] ?? <Icon name="info" size={18} />}</span>
              <span className="test-result__name">{result.name}</span>
              <span className="test-result__status" style={{ color: STATUS_COLOR[result.status] ?? '#6b7280' }}>
                {STATUS_LABEL[result.status] ?? result.status.toUpperCase()}
              </span>
            </div>
            <div className="test-result__message">{result.message}</div>
            {result.details && (
              <details className="test-result__details">
                <summary>Подробнее</summary>
                <pre className="test-result__details-content">{JSON.stringify(result.details, null, 2)}</pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="cluster-test-runner">
      <div className="cluster-test-runner__header">
        <p>Запустите тесты для проверки работоспособности кластера</p>
      </div>

      <div className="test-selection">
        <h3>Выберите набор тестов</h3>
        <div className="test-buttons">
          {testTypes.map((test) => (
            <button
              key={test.id}
              onClick={() => runTest(test.id)}
              disabled={isRunning}
              className={`test-button${selectedTest === test.id ? ' test-button--selected' : ''}${isRunning ? ' test-button--loading' : ''}`}
            >
              <div className="test-button__name"><Icon name={test.icon} size={16} /> {test.name}</div>
              <div className="test-button__description">{test.description}</div>
            </button>
          ))}
        </div>
      </div>

      {isRunning && (
        <div className="test-loading">
          <div className="test-loading__spinner"><Icon name="refresh" size={32} /></div>
          <div className="test-loading__message">
            Выполняется {testTypes.find(t => t.id === selectedTest)?.name ?? 'тесты'}...
          </div>
        </div>
      )}

      {testResults && (
        <div className="test-results-container">
          <div className="test-results__header">
            <h3>
              {testResults.success
                ? <><Icon name="success" size={18} /> Результаты тестов</>
                : <><Icon name="error"   size={18} /> Тест провален</>}
            </h3>
            <div className="test-results__meta">
              <span>Длительность: {testResults.duration}мс</span>
              <span>Завершено: {new Date(testResults.timestamp).toLocaleString('ru-RU')}</span>
            </div>
          </div>

          {testResults.error && (
            <div className="test-error">
              <strong>Ошибка:</strong> {testResults.error}
            </div>
          )}

          {testResults.success && testResults.testSuite && renderTestSuite(testResults.testSuite)}

          {testResults.success && testResults.testSuites && (
            <div className="comprehensive-results">
              {testResults.overallSummary && (
                <div className="overall-summary">
                  <h3><Icon name="chart" size={18} /> Общая сводка</h3>
                  <div className="summary-stats">
                    <div className="summary-stat summary-stat--total">
                      <span className="summary-stat__label">Всего тестов</span>
                      <span className="summary-stat__value">{testResults.overallSummary.total}</span>
                    </div>
                    <div className="summary-stat summary-stat--success">
                      <span className="summary-stat__label">Пройдено</span>
                      <span className="summary-stat__value">{testResults.overallSummary.passed}</span>
                    </div>
                    <div className="summary-stat summary-stat--warning">
                      <span className="summary-stat__label">Предупреждений</span>
                      <span className="summary-stat__value">{testResults.overallSummary.warnings}</span>
                    </div>
                    <div className="summary-stat summary-stat--error">
                      <span className="summary-stat__label">Провалено</span>
                      <span className="summary-stat__value">{testResults.overallSummary.failed}</span>
                    </div>
                  </div>
                </div>
              )}
              {testResults.testSuites.map((suite, index) => renderTestSuite(suite, index))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClusterTestRunner;
