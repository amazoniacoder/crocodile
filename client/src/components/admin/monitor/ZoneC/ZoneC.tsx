import React, { useEffect, useState, useCallback } from 'react';
import { adminApi, NewsSource } from '@/services/adminApi';
import { SourcesTable } from './SourcesTable';
import { IntervalConfig } from './IntervalConfig';
import { ManualCollect } from './ManualCollect';
import { DonateConfig } from './DonateConfig';
import { Icon } from '@/ui-system/icons/components';

interface Props {
  token: string;
}

const ZoneC: React.FC<Props> = ({ token }) => {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [error, setError]     = useState<string | null>(null);

  const fetchSources = useCallback(() => {
    adminApi.getSources(token)
      .then(res => setSources(res.sources))
      .catch(err => setError(err instanceof Error ? err.message : 'Ошибка загрузки'));
  }, [token]);

  useEffect(() => {
    fetchSources();
    const id = setInterval(fetchSources, 60_000);
    return () => clearInterval(id);
  }, [fetchSources]);

  return (
    <div className="monitor-section">
      <div className="monitor-zonec-toolbar">
        <DonateConfig token={token} />
        <div className="monitor-zonec-right">
          <IntervalConfig token={token} />
          <ManualCollect token={token} />
        </div>
      </div>
      {error && <p className="monitor-modal__error">{error}</p>}
      <SourcesTable token={token} sources={sources} onRefresh={fetchSources} />
    </div>
  );
};

export default ZoneC;
