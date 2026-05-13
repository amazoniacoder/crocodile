import React, { useRef, useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useHeader, NavigationItem } from './HeaderContext';
import { useHeaderSpace } from '../../hooks/useHeaderSpace';
import { useNewsNotificationsStore } from '@/store/newsNotificationsStore';
import { ENABLED_REGIONS_EVENT, readEnabledRegionsSnapshot } from '@/contexts/enabled-regions-context';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface SmartNavigationProps {
  items: NavigationItem[];
  menuItems?: any[];
  onLinkClick?: () => void;
  onNavClick?: (href: string) => void;
  activeHref?: string;
  className?: string;
}

// SVG-стрелка — анимируется через CSS transform
const ChevronIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    aria-hidden
  >
    <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SmartNavigation: React.FC<SmartNavigationProps> = ({
  items, onLinkClick, onNavClick, activeHref, className = ''
}) => {
  const navRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { visibleItems } = useHeader();
  const [location] = useLocation();
  const { counts } = useNewsNotificationsStore();
  const online = useOnlineStatus();
  const [enabledRegions, setEnabledRegions] = useState({ russia: true, world: true, cities: true });
  const [highlight, setHighlight] = useState<{ left: number; width: number } | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobileRef = useRef(false);

  useHeaderSpace({ navigationItems: items, containerRef: navRef });

  useEffect(() => {
    const sync = () => setEnabledRegions(readEnabledRegionsSnapshot().enabledRegions);
    sync();
    window.addEventListener(ENABLED_REGIONS_EVENT, sync as EventListener);

    return () => {
      window.removeEventListener(ENABLED_REGIONS_EVENT, sync as EventListener);
    };
  }, []);

  // Определяем мобиль по ширине окна
  useEffect(() => {
    const check = () => { isMobileRef.current = window.innerWidth < 768; };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const isActive = (url?: string) => {
    if (!url || url.startsWith('#')) return false;
    return url.split('?')[0] === location.split('?')[0];
  };

  const getItemEl = (href?: string) => {
    if (!listRef.current || !href) return null;
    return listRef.current.querySelector(`[data-href="${href}"]`) as HTMLElement | null;
  };

  const measureEl = (el: HTMLElement): { left: number; width: number } => {
    const listRect = listRef.current!.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    return { left: elRect.left - listRect.left, width: elRect.width };
  };

  useEffect(() => {
    const activeItem = visibleItems.find(item =>
      isActive(item.href) || item.href === activeHref
    );
    if (!activeItem) { setHighlight(null); return; }
    requestAnimationFrame(() => {
      const el = getItemEl(activeItem.href);
      if (el) setHighlight(measureEl(el));
    });
  }, [location, activeHref, visibleItems]);

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  // Desktop: открываем по hover
  const handleItemMouseEnter = (item: NavigationItem) => {
    if (isMobileRef.current) return;
    clearHoverTimeout();
    const el = getItemEl(item.href);
    if (el) setHighlight(measureEl(el));
    if (item.subItems?.length) setOpenDropdown(item.id);
  };

  const handleItemMouseLeave = () => {
    if (isMobileRef.current) return;
    clearHoverTimeout();
    hoverTimeoutRef.current = setTimeout(() => {
      setOpenDropdown(null);
      const activeItem = visibleItems.find(item =>
        isActive(item.href) || item.href === activeHref
      );
      if (!activeItem) { setHighlight(null); return; }
      const el = getItemEl(activeItem.href);
      if (el) setHighlight(measureEl(el));
    }, 150);
  };

  // Mobile: кнопка стрелки — мгновенное переключение, без таймаутов
  const handleArrowClick = (e: React.MouseEvent, item: NavigationItem) => {
    e.preventDefault();
    e.stopPropagation();
    clearHoverTimeout();
    // Если открыто это — закрыть, иначе открыть это (закрыв предыдущее)
    setOpenDropdown(prev => prev === item.id ? null : item.id);
  };

  const buildCategoryHref = (baseHref: string, category: string) =>
    `${baseHref}/${category}`;

  const HREF_TO_REGION: Record<string, string> = {
    '/russia': 'russia',
    '/world': 'world',
    '/all': 'all',
    '/social': 'social',
  };

  return (
    <div className={`header__nav-content ${className}`} ref={navRef}>
      <div
        className="header__nav-list list-none m-0 p-0"
        ref={listRef}
      >
        {highlight && (
          <span
            className="header__nav-highlight"
            style={{ left: highlight.left, width: highlight.width }}
          />
        )}

        {visibleItems.map((item) => {
          const active = isActive(item.href) || item.href === activeHref;
          const hasDropdown = !!item.subItems?.length;
          const isOpen = openDropdown === item.id;

          return (
            <div
              key={item.id}
              className={`header__nav-item${hasDropdown ? ' header__nav-item--has-dropdown' : ''}${isOpen ? ' header__nav-item--dropdown-open' : ''}`}
              onMouseEnter={() => handleItemMouseEnter(item)}
              onMouseLeave={handleItemMouseLeave}
            >
              <div className="header__nav-row">
                <Link
                  href={item.href || '#'}
                  data-href={item.href}
                  className={`header__nav-link${active ? ' header__nav-link--active' : ''}`}
                  onClick={(e) => {
                    if (item.href?.startsWith('#')) {
                      e.preventDefault();
                      onNavClick?.(item.href);
                      return;
                    }
                    if (item.href === '/' && location === '/') {
                      e.preventDefault();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      return;
                    }
                    setOpenDropdown(null);
                    onLinkClick?.();
                  }}
                >
                  {item.label}
                  {item.href === '/about' && (
                    <span
                      className={`header__nav-online-dot header__nav-online-dot--${online ? 'online' : 'offline'}`}
                      data-label={online ? 'Онлайн' : 'Офлайн'}
                      aria-hidden
                    />
                  )}

                  {(() => {
                    const regionKey = item.href ? HREF_TO_REGION[item.href] : undefined;
                    const isRegionEnabled =
                      regionKey === 'russia'
                        ? enabledRegions.russia
                        : regionKey === 'world'
                          ? enabledRegions.world
                          : true;
                    const count = regionKey && isRegionEnabled ? (counts[regionKey] ?? 0) : 0;
                    return count > 0 ? (
                      <span className="header__nav-badge">{count > 99 ? '99+' : count}</span>
                    ) : null;
                  })()}
                  {hasDropdown && (
                    <ChevronIcon
                      className={`header__nav-chevron header__nav-chevron--desktop${isOpen ? ' header__nav-chevron--open' : ''}`}
                    />
                  )}
                </Link>

                {hasDropdown && (
                  <button
                    className={`header__nav-arrow-btn${isOpen ? ' header__nav-arrow-btn--open' : ''}`}
                    onClick={(e) => handleArrowClick(e, item)}
                    aria-label={`${isOpen ? 'Закрыть' : 'Открыть'} подменю ${item.label}`}
                    aria-expanded={isOpen}
                  >
                    <ChevronIcon className="header__nav-chevron" />
                  </button>
                )}
              </div>

              {hasDropdown && (
                <div
                  className={`header__nav-dropdown${isOpen ? ' header__nav-dropdown--open' : ''}`}
                  onMouseEnter={clearHoverTimeout}
                  onMouseLeave={handleItemMouseLeave}
                >
                  {item.subItems!.map((sub) => {
                    // Поддержка двух типов: category (для категорий) и href (для обычных ссылок)
                    const href = sub.href || (sub.category ? buildCategoryHref(item.href!, sub.category) : '#');
                    const subActive = location === href;
                    const key = sub.href || sub.category || sub.label;
                    return (
                      <Link
                        key={key}
                        href={href}
                        className={`header__nav-dropdown-link${subActive ? ' header__nav-dropdown-link--active' : ''}`}
                        onClick={() => {
                          setOpenDropdown(null);
                          onLinkClick?.();
                        }}
                      >
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
