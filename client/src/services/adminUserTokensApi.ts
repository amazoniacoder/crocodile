const API_BASE = '/api/admin/user-tokens';

export interface UserToken {
  id: number;
  token: string;
  label: string | null;
  isActive: boolean;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  subscriptionsCount?: number;
}

export interface TokenStats {
  activeTokens: number;
  totalTokens: number;
  totalSubscriptions: number;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export const adminUserTokensApi = {
  async getTokens(token: string): Promise<{ tokens: UserToken[] }> {
    const res = await fetch(API_BASE, { headers: authHeaders(token) });
    if (!res.ok) throw new Error('Failed to fetch tokens');
    return res.json();
  },

  async createToken(token: string, data: { label: string; expiresAt?: string }): Promise<{ token: UserToken }> {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create token');
    return res.json();
  },

  async updateToken(token: string, id: number, data: Partial<Pick<UserToken, 'label' | 'isActive' | 'expiresAt'>>): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update token');
    return res.json();
  },

  async deleteToken(token: string, id: number): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to delete token');
    return res.json();
  },

  async getTokenSubscriptions(token: string, id: number): Promise<{ sourceIds: number[] }> {
    const res = await fetch(`${API_BASE}/${id}/subscriptions`, { headers: authHeaders(token) });
    if (!res.ok) throw new Error('Failed to fetch subscriptions');
    return res.json();
  },

  async updateTokenSubscriptions(token: string, id: number, sourceIds: number[]): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/${id}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ sourceIds }),
    });
    if (!res.ok) throw new Error('Failed to update subscriptions');
    return res.json();
  },

  async getStats(token: string): Promise<TokenStats> {
    const res = await fetch(`${API_BASE}/stats`, { headers: authHeaders(token) });
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },
};
