import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Icon } from '@/ui-system/icons/components';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const TOKEN_KEY = 'userToken';

export const MyFeedButton: React.FC = () => {
  const [, navigate] = useLocation();
  const isOnline = useOnlineStatus();
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem(TOKEN_KEY));
  const [subsCount, setSubsCount] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const sync = () => {
      const hasToken = !!localStorage.getItem(TOKEN_KEY);
      setIsLoggedIn(hasToken);
      if (!hasToken) setSubsCount(null);
    };
    window.addEventListener('storage', sync);
    window.addEventListener('userTokenChanged', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('userTokenChanged', sync);
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    fetch('/api/my/subscriptions', { headers: { 'X-User-Token': token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.sourceIds && setSubsCount(d.sourceIds.length))
      .catch(() => {});
  }, [isLoggedIn]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuOpen &&
          menuRef.current &&
          buttonRef.current &&
          !menuRef.current.contains(e.target as Node) &&
          !buttonRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event('userTokenChanged'));
    setIsLoggedIn(false);
    setSubsCount(null);
    setMenuOpen(false);
    navigate('/');
    // Закрываем мобильное меню если оно открыто
    const hamburger = document.querySelector('.header__hamburger');
    if (hamburger?.classList.contains('header__hamburger--active')) {
      (hamburger as HTMLButtonElement).click();
    }
  };

  const handleGoToCabinet = () => {
    setMenuOpen(false);
    navigate('/my');
    // Закрываем мобильное меню если оно открыто
    const hamburger = document.querySelector('.header__hamburger');
    if (hamburger?.classList.contains('header__hamburger--active')) {
      (hamburger as HTMLButtonElement).click();
    }
  };

  const tooltip = isLoggedIn
    ? subsCount !== null
      ? `Личный кабинет • ${subsCount} канал${subsCount === 1 ? '' : subsCount < 5 ? 'а' : 'ов'}`
      : 'Личный кабинет'
    : 'Личный кабинет';

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        className="header__icon-link"
        onClick={() => isLoggedIn ? setMenuOpen(!menuOpen) : navigate('/my')}
        title={tooltip}
        aria-label={tooltip}
        style={{ position: 'relative' }}
      >
        <Icon name="person" size={20} />
        {isLoggedIn && (
          <span
            className={`header__nav-online-dot header__nav-online-dot--${isOnline ? 'online' : 'offline'}`}
            data-label={isOnline ? 'Онлайн' : 'Офлайн'}
            aria-hidden
            style={{ top: 2, right: 2 }}
          />
        )}
      </button>
      {isLoggedIn && menuOpen && (
        <div
          ref={menuRef}
          className="header__user-menu-dropdown"
        >
          <button className="header__user-menu-item" onClick={handleGoToCabinet}>
            <Icon name="person" size={16} />
            <span>Мой кабинет</span>
          </button>
          <button className="header__user-menu-item" onClick={handleLogout}>
            <Icon name="logout" size={16} />
            <span>Выйти</span>
          </button>
        </div>
      )}
    </div>
  );
};
