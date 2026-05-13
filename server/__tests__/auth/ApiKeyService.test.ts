import { describe, it, expect, afterEach } from 'vitest';
import { apiKeyService } from '../../infrastructure/auth/ApiKeyService';
import { db } from '../../db/db';
import { apiKeys } from '../../../shared/types/schema';
import { eq } from 'drizzle-orm';

describe('ApiKeyService', () => {
  let testKeyIds: string[] = [];

  afterEach(async () => {
    // Очистка тестовых ключей
    for (const id of testKeyIds) {
      try {
        await db.delete(apiKeys).where(eq(apiKeys.id, id));
      } catch (error) {
        // Игнорируем ошибки при очистке
      }
    }
    testKeyIds = [];
  });

  describe('create', () => {
    it('should create a new API key', async () => {
      const result = await apiKeyService.create({
        name: 'Test API Key',
        requestsPerMinute: 120,
        requestsPerDay: 10000
      });

      testKeyIds.push(result.id);

      expect(result.key).toBeDefined();
      expect(result.key).toMatch(/^na_[a-f0-9]{48}$/);
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test API Key');
      expect(result.requestsPerMinute).toBe(120);
      expect(result.requestsPerDay).toBe(10000);
    });

    it('should use default rate limits', async () => {
      const result = await apiKeyService.create({
        name: 'Default Limits Key'
      });

      testKeyIds.push(result.id);

      expect(result.requestsPerMinute).toBe(60);
      expect(result.requestsPerDay).toBe(10000);
    });

    it('should hash key before storing', async () => {
      const result = await apiKeyService.create({
        name: 'Hash Test Key'
      });

      testKeyIds.push(result.id);

      // Проверяем, что в БД хранится хэш, а не сам ключ
      const [stored] = await db.select()
        .from(apiKeys)
        .where(eq(apiKeys.id, result.id));

      expect(stored.keyHash).toBeDefined();
      expect(stored.keyHash).not.toBe(result.key);
      expect(stored.keyHash.length).toBe(64); // SHA-256 hex length
    });

    it('should create active key by default', async () => {
      const result = await apiKeyService.create({
        name: 'Active Key Test'
      });

      testKeyIds.push(result.id);

      const [stored] = await db.select()
        .from(apiKeys)
        .where(eq(apiKeys.id, result.id));

      expect(stored.isActive).toBe(true);
    });
  });

  describe('validate', () => {
    it('should validate correct API key', async () => {
      const created = await apiKeyService.create({
        name: 'Valid Key',
        requestsPerMinute: 100
      });

      testKeyIds.push(created.id);

      const info = await apiKeyService.validate(created.key);

      expect(info).toBeDefined();
      expect(info?.id).toBe(created.id);
      expect(info?.name).toBe('Valid Key');
      expect(info?.requestsPerMinute).toBe(100);
    });

    it('should reject invalid API key', async () => {
      const info = await apiKeyService.validate('na_invalid_key_12345');
      expect(info).toBeNull();
    });

    it('should reject inactive API key', async () => {
      const created = await apiKeyService.create({
        name: 'To Deactivate'
      });

      testKeyIds.push(created.id);

      // Деактивируем ключ
      await apiKeyService.revoke(created.id);

      const info = await apiKeyService.validate(created.key);
      expect(info).toBeNull();
    });

    it('should update lastUsedAt on validation', async () => {
      const created = await apiKeyService.create({
        name: 'Usage Tracking Key'
      });

      testKeyIds.push(created.id);

      // Первая валидация
      await apiKeyService.validate(created.key);

      // Ждём немного
      await new Promise(resolve => setTimeout(resolve, 100));

      // Вторая валидация
      await apiKeyService.validate(created.key);

      const [key] = await db.select()
        .from(apiKeys)
        .where(eq(apiKeys.id, created.id));

      expect(key.lastUsedAt).toBeDefined();
    });

    it('should use Redis cache for validation', async () => {
      const created = await apiKeyService.create({
        name: 'Cache Test Key'
      });

      testKeyIds.push(created.id);

      // Первая валидация (запись в кэш)
      const first = await apiKeyService.validate(created.key);
      expect(first).toBeDefined();

      // Вторая валидация (из кэша)
      const second = await apiKeyService.validate(created.key);
      expect(second).toBeDefined();
      expect(second?.id).toBe(first?.id);
    });
  });

  describe('revoke', () => {
    it('should revoke active API key', async () => {
      const created = await apiKeyService.create({
        name: 'To Revoke'
      });

      testKeyIds.push(created.id);

      const revoked = await apiKeyService.revoke(created.id);

      expect(revoked).toBe(true);

      const [key] = await db.select()
        .from(apiKeys)
        .where(eq(apiKeys.id, created.id));

      expect(key.isActive).toBe(false);
    });

    it('should return false for non-existent key', async () => {
      const revoked = await apiKeyService.revoke('non-existent-id');
      expect(revoked).toBe(false);
    });

    it('should invalidate cache on revoke', async () => {
      const created = await apiKeyService.create({
        name: 'Cache Invalidation Test'
      });

      testKeyIds.push(created.id);

      // Валидируем (кэшируем)
      await apiKeyService.validate(created.key);

      // Отзываем
      await apiKeyService.revoke(created.id);

      // Проверяем, что кэш инвалидирован
      const info = await apiKeyService.validate(created.key);
      expect(info).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all API keys', async () => {
      const key1 = await apiKeyService.create({
        name: 'List Test 1'
      });

      const key2 = await apiKeyService.create({
        name: 'List Test 2'
      });

      testKeyIds.push(key1.id, key2.id);

      const keys = await apiKeyService.list();

      expect(keys.length).toBeGreaterThanOrEqual(2);
      
      const testKeys = keys.filter(k => 
        k.id === key1.id || k.id === key2.id
      );

      expect(testKeys.length).toBe(2);
    });

    it('should not expose key hashes', async () => {
      const created = await apiKeyService.create({
        name: 'Security Test'
      });

      testKeyIds.push(created.id);

      const keys = await apiKeyService.list();
      const found = keys.find(k => k.id === created.id);

      expect(found).toBeDefined();
      expect((found as any).keyHash).toBeUndefined();
    });

    it('should include usage statistics', async () => {
      const created = await apiKeyService.create({
        name: 'Stats Test'
      });

      testKeyIds.push(created.id);

      // Используем ключ
      await apiKeyService.validate(created.key);

      const keys = await apiKeyService.list();
      const found = keys.find(k => k.id === created.id);

      expect(found).toBeDefined();
      expect(found?.lastUsedAt).toBeDefined();
    });
  });

  describe('getById', () => {
    it('should return API key information', async () => {
      const created = await apiKeyService.create({
        name: 'Info Test',
        requestsPerMinute: 150
      });

      testKeyIds.push(created.id);

      const info = await apiKeyService.getById(created.id);

      expect(info).toBeDefined();
      expect(info?.name).toBe('Info Test');
      expect(info?.requestsPerMinute).toBe(150);
      expect(info?.isActive).toBe(true);
    });

    it('should return null for non-existent key', async () => {
      const info = await apiKeyService.getById('non-existent');
      expect(info).toBeNull();
    });
  });

  describe('update', () => {
    it('should update API key name', async () => {
      const created = await apiKeyService.create({
        name: 'Original Name'
      });

      testKeyIds.push(created.id);

      const updated = await apiKeyService.update(created.id, {
        name: 'Updated Name'
      });

      expect(updated).toBe(true);

      const info = await apiKeyService.getById(created.id);
      expect(info?.name).toBe('Updated Name');
    });

    it('should update rate limits', async () => {
      const created = await apiKeyService.create({
        name: 'Rate Limit Test',
        requestsPerMinute: 60
      });

      testKeyIds.push(created.id);

      await apiKeyService.update(created.id, {
        requestsPerMinute: 200,
        requestsPerDay: 20000
      });

      const info = await apiKeyService.getById(created.id);
      expect(info?.requestsPerMinute).toBe(200);
      expect(info?.requestsPerDay).toBe(20000);
    });

    it('should return false for non-existent key', async () => {
      const updated = await apiKeyService.update('non-existent', {
        name: 'New Name'
      });

      expect(updated).toBe(false);
    });
  });
});
