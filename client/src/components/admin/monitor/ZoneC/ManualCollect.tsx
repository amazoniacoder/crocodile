import React, { useState } from 'react';
import { adminApi } from '@/services/adminApi';

interface Props {
  token: string;
}

export const ManualCollect: React.FC<Props> = ({ token }) => {
  const [loading, setLoading]   = useState(false);
  const [hotEntitiesLoading, setHotEntitiesLoading] = useState(false);
  const [result, setResult]     = useState<{ durationMs: number } | null>(null);
  const [hotEntitiesResult, setHotEntitiesResult] = useState<{ entitiesProcessed: number; duration: number } | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [hotEntitiesError, setHotEntitiesError] = useState<string | null>(null);

  const handleHotEntities = async () => {
    setHotEntitiesLoading(true);
    setHotEntitiesResult(null);
    setHotEntitiesError(null);
    try {
      const response = await fetch('/api/admin/jobs/hot-entities', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setHotEntitiesResult({
          entitiesProcessed: data.data.entitiesProcessed,
          duration: data.data.duration
        });
      } else {
        throw new Error(data.message || 'Job failed');
      }
    } catch (err) {
      setHotEntitiesError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setHotEntitiesLoading(false);
    }
  };

  const handleCollect = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await adminApi.collect(token);
      setResult({ durationMs: res.durationMs });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="monitor-card monitor-collect-card">
      <h3 className="monitor-card__title">Ручной сбор</h3>
      <div className="monitor-collect">
        <div className="monitor-collect__buttons">
          <button
            className="monitor-btn monitor-btn--primary monitor-btn--lg"
            onClick={handleCollect}
            disabled={loading}
          >
            {loading ? '⏳ Сбор...' : '▶ Собрать сейчас'}
          </button>
          <button
            className="monitor-btn monitor-btn--secondary monitor-btn--lg"
            onClick={handleHotEntities}
            disabled={hotEntitiesLoading}
          >
            {hotEntitiesLoading ? '⏳ Обновление...' : '🔥 Hot Entities'}
          </button>
        </div>
        {loading && <div className="monitor-collect__progress" />}
        {result && (
          <p className="monitor-collect__result monitor-collect__result--ok">
            ✓ RSS готово за {(result.durationMs / 1000).toFixed(1)} сек
          </p>
        )}
        {hotEntitiesResult && (
          <p className="monitor-collect__result monitor-collect__result--ok">
            ✓ Hot Entities: {hotEntitiesResult.entitiesProcessed} сущностей за {(hotEntitiesResult.duration / 1000).toFixed(1)} сек
          </p>
        )}
        {error && <p className="monitor-collect__result monitor-collect__result--error">{error}</p>}
        {hotEntitiesError && <p className="monitor-collect__result monitor-collect__result--error">{hotEntitiesError}</p>}
      </div>
    </div>
  );
};
