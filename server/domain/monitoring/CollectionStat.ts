export interface CollectionStat {
  id: number;
  sourceId: number | null;
  collectedAt: Date;
  articlesInserted: number;
  articlesDuplicate: number;
  fetchDurationMs: number | null;
  avgLatencyMs: number | null;
  errorCount: number;
  lastError: string | null;
}

export interface NewCollectionStat {
  sourceId: number | null;
  articlesInserted: number;
  articlesDuplicate: number;
  fetchDurationMs: number | null;
  avgLatencyMs: number | null;
  errorCount: number;
  lastError: string | null;
}
