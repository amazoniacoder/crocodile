import React, { useState } from 'react';

interface Props {
  onLogin: (token: string) => Promise<boolean>;
  error: string | null;
  loading: boolean;
}

export const MonitorLoginForm: React.FC<Props> = ({ onLogin, error, loading }) => {
  const [value, setValue] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) await onLogin(value.trim());
  };

  return (
    <div className="monitor-login">
      <div className="monitor-login__card">
        <h1 className="monitor-login__title">Кабинет мониторинга</h1>
        <p className="monitor-login__subtitle">Введите токен администратора</p>
        <form className="monitor-login__form" onSubmit={handleSubmit}>
          <input
            className="monitor-login__input"
            type="password"
            placeholder="ADMIN_TOKEN"
            value={value}
            onChange={e => setValue(e.target.value)}
            autoFocus
            autoComplete="current-password"
          />
          {error && <p className="monitor-login__error">{error}</p>}
          <button
            className="monitor-login__btn"
            type="submit"
            disabled={loading || !value.trim()}
          >
            {loading ? 'Проверка...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
};
