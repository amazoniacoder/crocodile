import React, { useState } from 'react';
import { TokensTab } from './TokensTab';
import { StatsTab } from './StatsTab';

type Tab = 'tokens' | 'stats';

interface ZoneNProps {
  token: string;
}

export const ZoneN: React.FC<ZoneNProps> = ({ token }) => {
  const [activeTab, setActiveTab] = useState<Tab>('tokens');

  return (
    <div className="zone-n">
      <div className="zone-n__header">
        <p className="zone-n__desc">Управление токенами личных кабинетов</p>
      </div>

      <div className="zone-n__tabs">
        <button
          className={`zone-n__tab${activeTab === 'tokens' ? ' zone-n__tab--active' : ''}`}
          onClick={() => setActiveTab('tokens')}
        >
          Токены
        </button>
        <button
          className={`zone-n__tab${activeTab === 'stats' ? ' zone-n__tab--active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Статистика
        </button>
      </div>

      <div className="zone-n__content">
        {activeTab === 'tokens' && <TokensTab token={token} />}
        {activeTab === 'stats' && <StatsTab token={token} />}
      </div>
    </div>
  );
};
