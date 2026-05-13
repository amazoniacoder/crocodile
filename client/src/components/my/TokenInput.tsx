import React, { useState } from 'react';
import { myApi } from '@/services/myApi';

interface TokenInputProps {
  onTokenSubmit: (token: string) => void;
  error?: string | null;
}

export const TokenInput: React.FC<TokenInputProps> = ({ onTokenSubmit, error: externalError }) => {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token.trim()) {
      setError('Введите токен');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { valid } = await myApi.validateToken(token.trim());
      
      if (valid) {
        localStorage.setItem('userToken', token.trim());
        onTokenSubmit(token.trim());
      } else {
        setError('Токен недействителен или истёк');
      }
    } catch {
      setError('Ошибка проверки токена');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="personal-feed__token-form">
      <h1 className="personal-feed__title">Личный кабинет</h1>
      <p className="personal-feed__subtitle">
        Введите токен доступа для просмотра персональной ленты
      </p>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          className="personal-feed__token-input"
          placeholder="ut_..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          className="personal-feed__token-submit"
          disabled={loading}
        >
          {loading ? 'Проверка...' : 'Войти'}
        </button>
      </form>

      {(error || externalError) && (
        <div className="personal-feed__token-error">
          {error || externalError}
        </div>
      )}

      <p className="personal-feed__token-hint">
        Получите токен через подписку на{' '}
        <a href="https://boosty.to/crocodile" target="_blank" rel="noopener noreferrer">
          Boosty
        </a>
      </p>
    </div>
  );
};
