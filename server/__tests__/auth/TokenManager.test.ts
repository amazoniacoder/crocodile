import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tokenManager } from '../../infrastructure/auth/TokenManager';
import { db } from '../../db/db';
import { adminTokens } from '../../../shared/types/schema';
import { eq } from 'drizzle-orm';

describe('TokenManager', () => {
  let testTokenIds: string[] = [];

  afterEach(async () => {
    // Очистка тестовых токенов
    for (const id of testTokenIds) {
      try {
        await db.delete(adminTokens).where(eq(adminTokens.id, id));
      } catch (error) {
        // Игнорируем ошибки при очистке
      }
    }
    testTokenIds = [];
  });

  describe('createToken', () => {
    it('should create a new admin token', async () => {
      const result = await tokenManager.createToken({
        name: 'Test Token',
        permissions: ['admin']
      });

      testTokenIds.push(result.tokenId);

      expect(result.token).toBeDefined();
      expect(result.token).toMatch(/^at_[a-f0-9]{64}$/);
      expect(result.tokenId).toBeDefined();
      expect(result.name).toBe('Test Token');
      expect(result.permissions).toEqual(['admin']);
    });

    it('should create token with custom permissions', async () => {
      const result = await tokenManager.createToken({
        name: 'Limited Token',
        permissions: ['read', 'write']
      });

      testTokenIds.push(result.tokenId);

      expect(result.permissions).toEqual(['read', 'write']);
    });

    it('should hash token before storing', async () => {
      const result = await tokenManager.createToken({
        name: 'Hash Test Token',
        permissions: ['admin']
      });

      testTokenIds.push(result.tokenId);

      // Проверяем, что в БД хранится хэш, а не сам токен
      const [stored] = await db.select()
        .from(adminTokens)
        .where(eq(adminTokens.id, result.tokenId));

      expect(stored.tokenHash).toBeDefined();
      expect(stored.tokenHash).not.toBe(result.token);
      expect(stored.tokenHash.length).toBe(60); // bcrypt hash length
    });
  });

  describe('validateToken', () => {
    it('should validate correct token', async () => {
      const created = await tokenManager.createToken({
        name: 'Valid Token',
        permissions: ['admin']
      });

      testTokenIds.push(created.tokenId);

      const validation = await tokenManager.validateToken(created.token);

      expect(validation.isValid).toBe(true);
      expect(validation.tokenId).toBe(created.tokenId);
      expect(validation.name).toBe('Valid Token');
      expect(validation.permissions).toEqual(['admin']);
    });

    it('should reject invalid token', async () => {
      const validation = await tokenManager.validateToken('at_invalid_token_12345');

      expect(validation.isValid).toBe(false);
      expect(validation.tokenId).toBeUndefined();
      expect(validation.reason).toBe('Token not found');
    });

    it('should reject revoked token', async () => {
      const created = await tokenManager.createToken({
        name: 'To Be Revoked',
        permissions: ['admin']
      });

      testTokenIds.push(created.tokenId);

      // Отзываем токен
      await tokenManager.revokeToken(created.tokenId);

      const validation = await tokenManager.validateToken(created.token);

      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBe('Token revoked');
    });
  });

  describe('revokeToken', () => {
    it('should revoke active token', async () => {
      const created = await tokenManager.createToken({
        name: 'To Revoke',
        permissions: ['admin']
      });

      testTokenIds.push(created.tokenId);

      const revoked = await tokenManager.revokeToken(created.tokenId);

      expect(revoked).toBe(true);

      const [token] = await db.select()
        .from(adminTokens)
        .where(eq(adminTokens.id, created.tokenId));

      expect(token.isRevoked).toBe(true);
      expect(token.revokedAt).toBeDefined();
    });

    it('should return false for non-existent token', async () => {
      const revoked = await tokenManager.revokeToken('non-existent-id');
      expect(revoked).toBe(false);
    });
  });

  describe('listTokens', () => {
    it('should list all tokens', async () => {
      const token1 = await tokenManager.createToken({
        name: 'List Test 1',
        permissions: ['admin']
      });

      const token2 = await tokenManager.createToken({
        name: 'List Test 2',
        permissions: ['read']
      });

      testTokenIds.push(token1.tokenId, token2.tokenId);

      const tokens = await tokenManager.listTokens();

      expect(tokens.length).toBeGreaterThanOrEqual(2);
      
      const testTokens = tokens.filter(t => 
        t.id === token1.tokenId || t.id === token2.tokenId
      );

      expect(testTokens.length).toBe(2);
    });

    it('should not expose token hashes', async () => {
      const created = await tokenManager.createToken({
        name: 'Security Test',
        permissions: ['admin']
      });

      testTokenIds.push(created.tokenId);

      const tokens = await tokenManager.listTokens();
      const found = tokens.find(t => t.id === created.tokenId);

      expect(found).toBeDefined();
      expect((found as any).tokenHash).toBeUndefined();
    });
  });
});
