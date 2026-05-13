export interface UserSubscription {
  id: number;
  tokenId: number;
  sourceId: number;
  subscribedAt: Date;
}

export interface SubscriptionUpdate {
  tokenId: number;
  sourceIds: number[];
}
