import React from 'react';
import { AnalyticsSummary } from '@/services/adminApi';

interface Props { summary: AnalyticsSummary | null; }

export const AnalyticsSummaryCards: React.FC<Props> = ({ summary }) => (
  <div className="monitor-grid monitor-grid--overview">
    <div className="monitor-stat">
      <div className="monitor-stat__label">Просмотров за 24ч</div>
      <div className="monitor-stat__value">{(summary?.pageviews ?? 0).toLocaleString('ru')}</div>
    </div>
    <div className="monitor-stat">
      <div className="monitor-stat__label">Уникальных визитов за 24ч</div>
      <div className="monitor-stat__value">{(summary?.uniques ?? 0).toLocaleString('ru')}</div>
      <div className="monitor-stat__sub">по суточному хэшу</div>
    </div>
    <div className="monitor-stat">
      <div className="monitor-stat__label">Кликов по новостям за 24ч</div>
      <div className="monitor-stat__value">{(summary?.clicks ?? 0).toLocaleString('ru')}</div>
    </div>
  </div>
);
