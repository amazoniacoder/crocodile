import { randomBytes } from 'crypto';

export interface UserToken {
  id: number;
  token: string;
  label: string | null;
  isActive: boolean;
  isAdmin?: boolean;
  createdAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
}

/**
 * Генерирует токен формата ut_<32 random bytes hex>
 */
export function generateUserToken(): string {
  const bytes = randomBytes(32);
  return `ut_${bytes.toString('hex')}`;
}

/**
 * Проверяет, истёк ли токен
 */
export function isTokenExpired(token: UserToken): boolean {
  if (!token.expiresAt) return false;
  return new Date() > token.expiresAt;
}

/**
 * Проверяет, валиден ли токен (активен и не истёк)
 */
export function isTokenValid(token: UserToken): boolean {
  return token.isActive && !isTokenExpired(token);
}
