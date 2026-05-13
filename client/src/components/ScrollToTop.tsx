import { useEffect } from 'react';
import { useLocation } from 'wouter';

const ScrollToTop: React.FC = () => {
  const [location] = useLocation();

  useEffect(() => {
    // Сбрасываем скролл после рендера нового маршрута
    const reset = () => {
      const feedList = document.querySelector('.news-feed__list') as HTMLElement | null;
      if (feedList) {
        feedList.scrollTo({ top: 0, behavior: 'smooth' });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    // requestAnimationFrame — ждём пока React отрисует новый маршрут
    const raf = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(raf);
  }, [location]);

  return null;
};

export default ScrollToTop;
