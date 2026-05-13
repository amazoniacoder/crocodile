import { Route, Switch, useLocation } from 'wouter';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from '@/ui-system/components/theme/ThemeProvider';
import { ColorThemeProvider } from '@/ui-system/components/theme';
import { FontSizeProvider } from '@/ui-system/components/accessibility';
import { NotificationProvider } from '@/ui-system/components/feedback';
import { WebSocketProvider } from '@/ui-system/hooks/useWebSocket';
import { Layout } from '@/ui-system/components/layout';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PwaUpdateToast } from './components/common/PwaUpdateToast';
import { RouteProvider } from './components/layout/RouteContext';
import { DisplaySettingsProvider } from './contexts/display-settings-context';
import ScrollToTop from './components/ScrollToTop';
import { useNewsNotifications } from './hooks/useNewsNotifications';
import { analytics } from './services/analytics';
import { useEffect } from 'react';
import HomePage from './pages/home';
import AllPage from './pages/all';
import AllCategoryPage from './pages/all-category';
import RussiaPage from './pages/russia';
import WorldPage from './pages/world';
import RussiaCategoryPage from './pages/russia-category';
import WorldCategoryPage from './pages/world-category';
import AboutPage from './pages/about';
import SourcesPage from './pages/sources';
import WeatherPage from './pages/WeatherPage';
import { TelegramPage } from './pages/telegram/TelegramPage';
import { TelegramChannelPage } from './pages/telegram/TelegramChannelPage';
import { YouTubePage } from './pages/youtube/YouTubePage';
import { YouTubeChannelPage } from './pages/youtube/YouTubeChannelPage';
import MyFeedPage from './pages/my/MyFeedPage';
import NotFoundPage from './pages/not-found';
import { lazy, Suspense } from 'react';
import NewsDetailPage from './pages/news-detail';
import EntityPage from './pages/entity';
import './ui-system/components/ErrorBoundary/ErrorBoundary.css';

const AdminMonitorPage = lazy(() => import('./pages/admin-monitor'));

function AppInner() {
  useNewsNotifications();
  const [location] = useLocation();

  useEffect(() => {
    // Не трекаем админку
    if (!location.startsWith('/admin')) {
      analytics.pageview(location);
    }
  }, [location]);

  return (
    <ErrorBoundary level="page" resetOnPropsChange resetKeys={[location]}>
      <Switch>
        <Route path="/admin/monitor">
          <ErrorBoundary level="section">
            <Suspense fallback={null}><AdminMonitorPage /></Suspense>
          </ErrorBoundary>
        </Route>
        <Route>
          <Layout>
            <ScrollToTop />
            <ErrorBoundary level="section">
              <Switch>
                <Route path="/"><HomePage /></Route>
                <Route path="/all"><AllPage /></Route>
                <Route path="/all/:category"><AllCategoryPage /></Route>
                <Route path="/russia"><RussiaPage /></Route>
                <Route path="/russia/:category"><RussiaCategoryPage /></Route>
                <Route path="/world"><WorldPage /></Route>
                <Route path="/world/:category"><WorldCategoryPage /></Route>
                <Route path="/news/:id"><NewsDetailPage /></Route>
                <Route path="/news/:id-:slug"><NewsDetailPage /></Route>
                <Route path="/entity/:term"><EntityPage /></Route>
                <Route path="/about"><AboutPage /></Route>
                <Route path="/sources"><SourcesPage /></Route>
                <Route path="/weather"><WeatherPage /></Route>
                <Route path="/social"><TelegramPage /></Route>
                <Route path="/social/channel/:username">
                  {(params) => <TelegramChannelPage params={params} />}
                </Route>
                <Route path="/youtube"><YouTubePage /></Route>
                <Route path="/youtube/channel/:channelId">
                  {(params) => <YouTubeChannelPage params={params} />}
                </Route>
                <Route path="/my"><MyFeedPage /></Route>
                <Route path="/my/telegram"><MyFeedPage initialTab="telegram" /></Route>
                <Route path="/my/youtube"><MyFeedPage initialTab="youtube" /></Route>
                <Route path="/my/telegram/:username">
                  {(params) => <TelegramChannelPage params={params} personal />}
                </Route>
                <Route path="/my/youtube/:channelId">
                  {(params) => <YouTubeChannelPage params={params} personal />}
                </Route>
                <Route component={NotFoundPage} />
              </Switch>
            </ErrorBoundary>
          </Layout>
        </Route>
      </Switch>
      <PwaUpdateToast />
    </ErrorBoundary>
  );
}

function App() {
  return (
    <HelmetProvider>
    <ErrorBoundary level="page">
      <ThemeProvider defaultTheme="light" storageKey="theme">
        <ColorThemeProvider>
        <FontSizeProvider>
          <NotificationProvider>
            <WebSocketProvider>
              <DisplaySettingsProvider>
                <RouteProvider>
                  <AppInner />
                </RouteProvider>
              </DisplaySettingsProvider>
            </WebSocketProvider>
          </NotificationProvider>
        </FontSizeProvider>
        </ColorThemeProvider>
      </ThemeProvider>
    </ErrorBoundary>
    </HelmetProvider>
  );
}

export default App;
