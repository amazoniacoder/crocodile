import type { DomainEvent } from './DomainEvent';

export interface ClusterUpdated extends DomainEvent {
  readonly type: 'cluster.updated';
  readonly clustersCreated: number;
  readonly singlesCount: number;
}
