import { useState, useCallback } from 'react';

const SESSION_KEY = 'admin_token';

export function useAdminAuth() {
  const [token, setToken] = useState<string | null>(
    () => sessionStorage.getItem(SESSION_KEY)
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (inputToken: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/news/sources', {
        headers: { Authorization: `Bearer ${inputToken}` },
      });
      if (res.ok) {
        sessionStorage.setItem(SESSION_KEY, inputToken);
        setToken(inputToken);
        return true;
      }
      setError('Неверный токен');
      return false;
    } catch {
      setError('Ошибка соединения');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setToken(null);
  }, []);

  return { token, login, logout, error, loading, isAuthenticated: !!token };
}
