import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Zone } from '@/pages/admin-monitor';
import { Icon } from '@/ui-system/icons/components';

interface Props {
  zone: Zone;
  onZoneChange: (z: Zone) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

interface TooltipState {
  text: string;
  x: number;
  y: number;
}

const ZONES: { id: Zone; icon: React.ReactNode; label: string; desc: string }[] = [
  { id: 'A', icon: <Icon name="satellite" size={20} />, label: 'Мониторинг', desc: 'Parser Health' },
  { id: 'B', icon: <Icon name="gear" size={20} />,      label: 'Система',    desc: 'Infrastructure' },
  { id: 'C', icon: <Icon name="sliders" size={20} />,   label: 'Управление', desc: 'Control Room' },
  { id: 'D', icon: <Icon name="chart" size={20} />,     label: 'Аналитика',  desc: 'Visits & Clicks' },
  { id: 'E', icon: <Icon name="fire" size={20} />,      label: 'Сущности',   desc: 'Hot Entities' },
  { id: 'F', icon: <Icon name="server" size={20} />,    label: 'Кластер',    desc: 'Cluster Health' },
  { id: 'G', icon: <Icon name="flask" size={20} />,     label: 'Тесты',      desc: 'Cluster Tests' },
  { id: 'H', icon: <Icon name="trending-up" size={20} />, label: 'SLA',      desc: 'Performance' },
  { id: 'I', icon: <Icon name="shield" size={20} />,    label: 'Токены',     desc: 'Token Management' },
  { id: 'J', icon: <Icon name="key" size={20} />,       label: 'API-ключи',  desc: 'Public API Keys' },
  { id: 'K', icon: <Icon name="sun" size={20} />,       label: 'Погода',      desc: 'Weather Cities' },
  { id: 'L', icon: <Icon name="telegram" size={20} />,  label: 'Telegram',   desc: 'TG Integration' },
  { id: 'M', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/></svg>, label: 'YouTube',   desc: 'YT Integration' },
  { id: 'N', icon: <Icon name="user" size={20} />,      label: 'User Tokens', desc: 'Personal Feed' },
  { id: 'O', icon: <Icon name="lock" size={20} />,      label: 'Админ',       desc: 'Private Channels' },
];

export const MonitorLayout: React.FC<Props> = ({ zone, onZoneChange, onLogout, children }) => {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const expandTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const rafRef = React.useRef<number | null>(null);

  const handleZoneClick = (zoneId: Zone) => {
    onZoneChange(zoneId);
    setSidebarExpanded(false);
  };

  const handleSidebarMouseEnter = () => {
    // Задержка перед раскрытием сайдбара
    expandTimeoutRef.current = setTimeout(() => {
      setSidebarExpanded(true);
    }, 300);
  };

  const handleSidebarMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    // Throttle с requestAnimationFrame
    if (rafRef.current) {
      return;
    }

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;

      // Найти кнопку под курсором (button с data-zone)
      const button = (e.target as HTMLElement).closest('button[data-zone]') as HTMLButtonElement;
      if (!button) {
        setTooltip(null);
        return;
      }

      const zoneId = button.getAttribute('data-zone');
      if (!zoneId) {
        setTooltip(null);
        return;
      }

      const zoneData = ZONES.find(z => z.id === zoneId);
      if (!zoneData) {
        setTooltip(null);
        return;
      }

      const rect = button.getBoundingClientRect();
      
      // Позиция тултипа: справа от сайдбара (учитываем раскрытое состояние)
      const sidebarWidth = sidebarExpanded ? 240 : 60;
      
      setTooltip({
        text: `Zone ${zoneId}: ${zoneData.label}`,
        x: sidebarWidth + 10,
        y: rect.top + rect.height / 2
      });
    });
  };

  const handleSidebarMouseLeave = () => {
    // Отменить раскрытие если курсор ушёл
    if (expandTimeoutRef.current) {
      clearTimeout(expandTimeoutRef.current);
      expandTimeoutRef.current = null;
    }
    setSidebarExpanded(false);
    setTooltip(null);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  React.useEffect(() => {
    return () => {
      if (expandTimeoutRef.current) {
        clearTimeout(expandTimeoutRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const currentZone = ZONES.find(z => z.id === zone);

  return (
    <>
      <div className="monitor">
      {/* Sidebar */}
      <aside
        className={`monitor__sidebar ${sidebarExpanded ? 'monitor__sidebar--expanded' : ''}`}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseMove={handleSidebarMouseMove}
        onMouseLeave={handleSidebarMouseLeave}
      >
        {/* Logo */}
        <div className="monitor__sidebar-logo">
          <Icon name="chart" size={24} />
        </div>

        {/* Navigation */}
        <nav className="monitor__sidebar-nav">
          {ZONES.map(z => (
            <button
              key={z.id}
              data-zone={z.id}
              className={`monitor__sidebar-item ${zone === z.id ? 'monitor__sidebar-item--active' : ''}`}
              onClick={() => handleZoneClick(z.id)}
            >
              <span className="monitor__sidebar-icon">{z.icon}</span>
              <div className="monitor__sidebar-content">
                <span className="monitor__sidebar-label">{z.label}</span>
                <span className="monitor__sidebar-desc">{z.desc}</span>
              </div>
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="monitor__sidebar-footer">
          <button 
            className="monitor__sidebar-item monitor__sidebar-logout" 
            onClick={onLogout}
            title="Выйти"
          >
            <span className="monitor__sidebar-icon">
              <Icon name="logout" size={20} />
            </span>
            <div className="monitor__sidebar-content">
              <span className="monitor__sidebar-label">Выйти</span>
              <span className="monitor__sidebar-desc">Logout</span>
            </div>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="monitor__main">
        <header className="monitor__header">
          <div className="monitor__header-left">
            <h1 className="monitor__title">Кабинет мониторинга</h1>
            <p className="monitor__subtitle">NewsAggregator</p>
          </div>
          {currentZone && (
            <div className="monitor__header-zone">
              <div className="monitor__zone-title">
                <span className="monitor__zone-icon">{currentZone.icon}</span>
                <div className="monitor__zone-info">
                  <span className="monitor__zone-label">Zone {zone}: {currentZone.label}</span>
                  <span className="monitor__zone-desc">{currentZone.desc}</span>
                </div>
              </div>
            </div>
          )}
        </header>

        <div className="monitor__content">
          <div className="monitor__content-inner">
            {children}
          </div>
        </div>
      </main>
      </div>

      {tooltip && createPortal(
        <div
          className="monitor__sidebar-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>,
        document.body
      )}
    </>
  );
};
