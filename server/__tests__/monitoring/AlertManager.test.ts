import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { alertManager } from '../../infrastructure/monitoring/AlertManager';

describe('AlertManager', () => {
  beforeEach(() => {
    // Сбрасываем состояние перед каждым тестом
    vi.clearAllMocks();
  });

  describe('Alert Rules', () => {
    it('should have default alert rules configured', () => {
      const rules = alertManager.getAllRules();

      expect(rules.length).toBeGreaterThan(0);
      
      // Проверяем наличие критических правил
      const criticalRules = rules.filter(r => r.severity === 'critical');
      expect(criticalRules.length).toBeGreaterThan(0);
    });

    it('should include database-critical rule', () => {
      const rules = alertManager.getAllRules();
      const dbRule = rules.find(r => r.id === 'database-critical');

      expect(dbRule).toBeDefined();
      expect(dbRule?.severity).toBe('critical');
      expect(dbRule?.enabled).toBe(true);
    });

    it('should include redis-unavailable rule', () => {
      const rules = alertManager.getAllRules();
      const redisRule = rules.find(r => r.id === 'redis-unavailable');

      expect(redisRule).toBeDefined();
      expect(redisRule?.severity).toBe('critical');
      expect(redisRule?.enabled).toBe(true);
    });

    it('should include rate-limiter-high-utilization rule', () => {
      const rules = alertManager.getAllRules();
      const rateLimiterRule = rules.find(r => r.id === 'rate-limiter-high-utilization');

      expect(rateLimiterRule).toBeDefined();
      expect(rateLimiterRule?.severity).toBe('warning');
      expect(rateLimiterRule?.enabled).toBe(true);
    });

    it('should include RSS collection rules', () => {
      const rules = alertManager.getAllRules();
      
      const rssStalled = rules.find(r => r.id === 'rss-collection-stalled');
      const highErrorRate = rules.find(r => r.id === 'high-error-rate');
      const lowArticleCount = rules.find(r => r.id === 'low-article-count');

      expect(rssStalled).toBeDefined();
      expect(highErrorRate).toBeDefined();
      expect(lowArticleCount).toBeDefined();
    });
  });

  describe('Alert Statistics', () => {
    it('should return alert statistics', async () => {
      const stats = await alertManager.getAlertStats();

      expect(stats).toBeDefined();
      expect(stats.activeAlerts).toBeDefined();
      expect(stats.criticalAlerts).toBeDefined();
      expect(stats.warningAlerts).toBeDefined();
      expect(stats.alertsLast24h).toBeDefined();
      expect(stats.averageResolutionTime).toBeDefined();
    });

    it('should track active alerts count', async () => {
      const stats = await alertManager.getAlertStats();
      expect(typeof stats.activeAlerts).toBe('number');
      expect(stats.activeAlerts).toBeGreaterThanOrEqual(0);
    });

    it('should separate critical and warning alerts', async () => {
      const stats = await alertManager.getAlertStats();
      
      expect(typeof stats.criticalAlerts).toBe('number');
      expect(typeof stats.warningAlerts).toBe('number');
      expect(stats.criticalAlerts).toBeGreaterThanOrEqual(0);
      expect(stats.warningAlerts).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Alert History', () => {
    it('should retrieve alert history', async () => {
      const history = await alertManager.getAlertHistory(10);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeLessThanOrEqual(10);
    });

    it('should limit history results', async () => {
      const limit = 5;
      const history = await alertManager.getAlertHistory(limit);

      expect(history.length).toBeLessThanOrEqual(limit);
    });

    it('should include alert details in history', async () => {
      const history = await alertManager.getAlertHistory(1);

      if (history.length > 0) {
        const alert = history[0];
        expect(alert.id).toBeDefined();
        expect(alert.ruleId).toBeDefined();
        expect(alert.ruleName).toBeDefined();
        expect(alert.severity).toBeDefined();
        expect(alert.message).toBeDefined();
        expect(alert.triggeredAt).toBeDefined();
      }
    });
  });

  describe('Active Alerts', () => {
    it('should retrieve active alerts', async () => {
      const activeAlerts = await alertManager.getActiveAlerts();

      expect(Array.isArray(activeAlerts)).toBe(true);
    });

    it('should only include unresolved alerts', async () => {
      const activeAlerts = await alertManager.getActiveAlerts();

      for (const alert of activeAlerts) {
        expect(alert.resolvedAt).toBeUndefined();
      }
    });
  });

  describe('Rule Management', () => {
    it('should toggle alert rule', async () => {
      const rules = alertManager.getAllRules();
      const testRule = rules[0];

      if (testRule) {
        const originalState = testRule.enabled;
        
        // Переключаем состояние
        const toggled = await alertManager.toggleRule(testRule.id, !originalState);
        expect(toggled).toBe(true);

        // Проверяем изменение
        const updatedRules = alertManager.getAllRules();
        const updatedRule = updatedRules.find(r => r.id === testRule.id);
        expect(updatedRule?.enabled).toBe(!originalState);

        // Возвращаем исходное состояние
        await alertManager.toggleRule(testRule.id, originalState);
      }
    });

    it('should return false for non-existent rule', async () => {
      const toggled = await alertManager.toggleRule('non-existent-rule', true);
      expect(toggled).toBe(false);
    });

    it('should disable rule when toggled off', async () => {
      const rules = alertManager.getAllRules();
      const enabledRule = rules.find(r => r.enabled);

      if (enabledRule) {
        await alertManager.toggleRule(enabledRule.id, false);

        const updatedRules = alertManager.getAllRules();
        const updatedRule = updatedRules.find(r => r.id === enabledRule.id);
        
        expect(updatedRule?.enabled).toBe(false);

        // Восстанавливаем
        await alertManager.toggleRule(enabledRule.id, true);
      }
    });
  });

  describe('Alert Acknowledgement', () => {
    it('should acknowledge alert', async () => {
      const activeAlerts = await alertManager.getActiveAlerts();

      if (activeAlerts.length > 0) {
        const alert = activeAlerts[0];
        const acknowledged = await alertManager.acknowledgeAlert(alert.id, 'test-admin');

        expect(acknowledged).toBe(true);
      }
    });

    it('should return false for non-existent alert', async () => {
      const acknowledged = await alertManager.acknowledgeAlert('non-existent-alert', 'test-admin');
      expect(acknowledged).toBe(false);
    });
  });

  describe('System Metrics Collection', () => {
    it('should collect system metrics', async () => {
      // Метод collectSystemMetrics приватный, но мы можем проверить его косвенно
      // через проверку работы правил
      const rules = alertManager.getAllRules();
      expect(rules.length).toBeGreaterThan(0);

      // Каждое правило имеет condition, которое использует SystemMetrics
      for (const rule of rules) {
        expect(rule.condition).toBeDefined();
        expect(typeof rule.condition).toBe('function');
      }
    });
  });

  describe('Alert Channels', () => {
    it('should have configured alert channels', () => {
      const rules = alertManager.getAllRules();

      for (const rule of rules) {
        expect(rule.channels).toBeDefined();
        expect(Array.isArray(rule.channels)).toBe(true);
        expect(rule.channels.length).toBeGreaterThan(0);

        // Проверяем структуру каналов
        for (const channel of rule.channels) {
          expect(channel.type).toBeDefined();
          expect(['email', 'webhook', 'websocket', 'log']).toContain(channel.type);
          expect(channel.enabled).toBeDefined();
          expect(typeof channel.enabled).toBe('boolean');
        }
      }
    });

    it('should have websocket channel enabled for critical alerts', () => {
      const rules = alertManager.getAllRules();
      const criticalRules = rules.filter(r => r.severity === 'critical');

      for (const rule of criticalRules) {
        const websocketChannel = rule.channels.find(c => c.type === 'websocket');
        expect(websocketChannel).toBeDefined();
        expect(websocketChannel?.enabled).toBe(true);
      }
    });

    it('should have log channel enabled for all alerts', () => {
      const rules = alertManager.getAllRules();

      for (const rule of rules) {
        const logChannel = rule.channels.find(c => c.type === 'log');
        expect(logChannel).toBeDefined();
        expect(logChannel?.enabled).toBe(true);
      }
    });
  });

  describe('Alert Cooldown', () => {
    it('should have cooldown configured for all rules', () => {
      const rules = alertManager.getAllRules();

      for (const rule of rules) {
        expect(rule.cooldownMinutes).toBeDefined();
        expect(typeof rule.cooldownMinutes).toBe('number');
        expect(rule.cooldownMinutes).toBeGreaterThan(0);
      }
    });

    it('should have shorter cooldown for critical alerts', () => {
      const rules = alertManager.getAllRules();
      const criticalRules = rules.filter(r => r.severity === 'critical');
      const warningRules = rules.filter(r => r.severity === 'warning');

      if (criticalRules.length > 0 && warningRules.length > 0) {
        const avgCriticalCooldown = criticalRules.reduce((sum, r) => sum + r.cooldownMinutes, 0) / criticalRules.length;
        const avgWarningCooldown = warningRules.reduce((sum, r) => sum + r.cooldownMinutes, 0) / warningRules.length;

        // Критические алерты обычно имеют более короткий cooldown
        expect(avgCriticalCooldown).toBeLessThanOrEqual(avgWarningCooldown);
      }
    });
  });
});
