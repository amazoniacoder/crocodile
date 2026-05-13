import React, { lazy, Suspense, useState } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { MonitorLoginForm } from '@/components/admin/monitor/MonitorLoginForm';
import { MonitorLayout } from '@/components/admin/monitor/MonitorLayout';

const ZoneA = lazy(() => import('@/components/admin/monitor/ZoneA/ZoneA'));
const ZoneB = lazy(() => import('@/components/admin/monitor/ZoneB/ZoneB'));
const ZoneC = lazy(() => import('@/components/admin/monitor/ZoneC/ZoneC'));
const ZoneD = lazy(() => import('@/components/admin/monitor/ZoneD/ZoneD'));
const ZoneE = lazy(() => import('@/components/admin/monitor/ZoneE/ZoneE'));
const ZoneF = lazy(() => import('@/components/admin/monitor/ZoneF'));
const ZoneG = lazy(() => import('@/components/admin/monitor/ZoneG'));
const ZoneH = lazy(() => import('@/components/admin/SlaMonitor').then(module => ({ default: module.SlaMonitor })));
const ZoneI = lazy(() => import('@/components/admin/TokenManager').then(module => ({ default: module.TokenManager })));
const ZoneJ = lazy(() => import('@/components/admin/monitor/ZoneJ/ZoneJ'));
const ZoneK = lazy(() => import('@/components/admin/monitor/ZoneK/ZoneK'));
const ZoneL = lazy(() => import('@/components/admin/monitor/ZoneL/ZoneL'));
const ZoneM = lazy(() => import('@/components/admin/monitor/ZoneM/ZoneM'));
const ZoneN = lazy(() => import('@/components/admin/monitor/ZoneN/ZoneN').then(module => ({ default: module.ZoneN })));
const ZoneO = lazy(() => import('@/components/admin/ZoneO').then(module => ({ default: module.ZoneO })));

export type Zone = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O';
export type ZoneATab = 'overview' | 'russia' | 'world' | 'errors' | 'blocked';

const AdminMonitorPage: React.FC = () => {
  const { token, login, logout, error, loading, isAuthenticated } = useAdminAuth();
  const [zone, setZone]       = useState<Zone>('A');
  const [zoneATab, setZoneATab] = useState<ZoneATab>('overview');

  const navigate = (targetZone: Zone, tab?: ZoneATab) => {
    setZone(targetZone);
    if (tab) setZoneATab(tab);
  };

  if (!isAuthenticated) {
    return <MonitorLoginForm onLogin={login} error={error} loading={loading} />;
  }

  return (
    <div className="monitor-page">
      <MonitorLayout zone={zone} onZoneChange={setZone} onLogout={logout}>
        <Suspense fallback={<div className="monitor__loading">Загрузка...</div>}>
          {zone === 'A' && <ZoneA token={token!} activeTab={zoneATab} onTabChange={setZoneATab} onNavigate={navigate} />}
          {zone === 'B' && <ZoneB token={token!} />}
          {zone === 'C' && <ZoneC token={token!} />}
          {zone === 'D' && <ZoneD token={token!} />}
          {zone === 'E' && <ZoneE token={token!} />}
          {zone === 'F' && <ZoneF adminToken={token!} />}
          {zone === 'G' && <ZoneG adminToken={token!} />}
          {zone === 'H' && <ZoneH token={token!} />}
          {zone === 'I' && <ZoneI adminToken={token!} />}
          {zone === 'J' && <ZoneJ token={token!} />}
          {zone === 'K' && <ZoneK token={token!} />}
          {zone === 'L' && <ZoneL token={token!} />}
          {zone === 'M' && <ZoneM token={token!} />}
          {zone === 'N' && <ZoneN token={token!} />}
          {zone === 'O' && <ZoneO adminToken={token!} />}
        </Suspense>
      </MonitorLayout>
    </div>
  );
};

export default AdminMonitorPage;
