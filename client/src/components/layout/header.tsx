import { useLocation } from 'wouter';
import { ThemeToggle, ThemeColorPicker } from '@/ui-system/components/theme';
import { HeaderProvider, Header } from '../../ui-system/components/header';
import { clientConfig } from '../../config/client.config';
import { MyFeedButton } from './MyFeedButton';

const CATEGORY_SUB_ITEMS = [
  { label: 'Экономика',  category: 'economy' },
  { label: 'Технологии', category: 'tech' },
  { label: 'Политика',   category: 'politics' },
  { label: 'Общество',   category: 'society' },
  { label: 'Другое',     category: 'other' },
];

const AppHeader = () => {
  const [location, navigate] = useLocation();

  const scrollFeedToTop = () => {
    // Ищем контейнер ленты новостей
    const feedList = document.querySelector('.news-feed__list') as HTMLElement;
    if (feedList) {
      feedList.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Если ленты нет, скроллим всю страницу
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const navigationItems = [
    { id: '1', label: 'Новости',    href: '/all',      priority: 1, subItems: CATEGORY_SUB_ITEMS },
    { id: '2', label: 'Россия', href: '/russia',   priority: 2, subItems: CATEGORY_SUB_ITEMS },
    { id: '3', label: 'Мир',   href: '/world',    priority: 3, subItems: CATEGORY_SUB_ITEMS },
    { id: '4', label: 'Соц. сети', href: '/social', priority: 4 },
    ...clientConfig.header.menu.map((m, i) => ({
      id: String(i + 5),
      label: m.label,
      href: m.href,
      priority: i + 5,
      // Преобразуем subItems из конфига в формат NavSubItem
      subItems: m.subItems?.map(sub => ({
        label: sub.label,
        href: sub.href,
      })),
    })),
  ];

  const activeHref = location === '/' ? '/all' : undefined;

  return (
    <HeaderProvider>
      <Header
        logo={
          <div 
            className="header__logo-link" 
            aria-label="Crocodile — на главную"
            onClick={() => {
              // Всегда переходим на главную
              navigate('/');
              // Скроллим ленту вверх
              setTimeout(() => scrollFeedToTop(), 100);
            }}
            style={{ cursor: 'pointer' }}
          >
            <img src="/icons/logo.svg" alt="Crocodile" className="header__logo-img" width={32} height={32} />
            <span className="header__logo-name">Crocodile</span>
          </div>
        }
        navigationItems={navigationItems}
        menuItems={[]}
        activeHref={activeHref}
        actions={<><ThemeColorPicker /><ThemeToggle /><a href="/api/rss" target="_blank" rel="noopener noreferrer" className="header__rss-link" title="RSS-лента"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg></a></>
        }
        persistentActions={<MyFeedButton />}
        slideMenuActions={<><ThemeColorPicker /><ThemeToggle /></>}
      />
    </HeaderProvider>
  );
};

export default AppHeader;
