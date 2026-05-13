import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { myApi } from '@/services/myApi';
import { TokenInput } from '@/components/my/TokenInput';
import { PersonalFeed } from '@/components/my/PersonalFeed';

interface MyFeedPageProps {
  initialTab?: 'all' | 'telegram' | 'youtube';
}

export function MyFeedPage({ initialTab }: MyFeedPageProps) {
  const [location, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const storedToken = localStorage.getItem('userToken');

    // Приоритет: токен из URL > токен из localStorage
    const candidateToken = urlToken || storedToken;

    if (!candidateToken) {
      setValidating(false);
      return;
    }

    // Валидация токена
    myApi
      .validateToken(candidateToken)
      .then(({ valid, expiresAt, isAdmin: adminFlag }) => {
        if (valid) {
          setToken(candidateToken);
          setExpiresAt(expiresAt ?? null);
          setIsAdmin(adminFlag ?? false);
          localStorage.setItem('userToken', candidateToken);
          window.dispatchEvent(new Event('userTokenChanged'));

          // Если токен был в URL → редирект без токена
          if (urlToken) {
            setLocation('/my');
          }
        } else {
          // Токен невалиден → очищаем localStorage
          localStorage.removeItem('userToken');
          window.dispatchEvent(new Event('userTokenChanged'));
          setToken(null);
          setError('Токен недействителен или истёк');
        }
      })
      .catch(() => {
        // Сетевая ошибка (офлайн) — токен остаётся, показываем кабинет из кэша
        if (storedToken && !urlToken) {
          setToken(storedToken);
          setValidating(false);
          return;
        }
        localStorage.removeItem('userToken');
        window.dispatchEvent(new Event('userTokenChanged'));
        setToken(null);
        setError('Нет соединения. Проверьте интернет и попробуйте снова.');
      })
      .finally(() => setValidating(false));
  }, [setLocation]);

  const handleTokenSubmit = (newToken: string) => {
    setToken(newToken);
    setError(null);
    window.dispatchEvent(new Event('userTokenChanged'));
  };

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    window.dispatchEvent(new Event('userTokenChanged'));
    setToken(null);
    setError(null);
  };

  if (validating) {
    return (
      <div className="personal-feed">
        <div className="personal-feed__validating">Проверка токена...</div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="personal-feed">
        <TokenInput onTokenSubmit={handleTokenSubmit} error={error} />
      </div>
    );
  }

  return <PersonalFeed token={token} onLogout={handleLogout} expiresAt={expiresAt} initialTab={initialTab} isAdmin={isAdmin} />;
}

export default MyFeedPage;
