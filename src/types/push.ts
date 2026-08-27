export type PushRegistrationStatus = {
  permission: "granted" | "denied" | "undetermined" | "unknown";
  projectIdConfigured: boolean;
  tokenRegistered: boolean;
  tokenPreview?: string;
  detail: string;
};

export type EbayNotificationStatus = {
  configured: boolean;
  connected: boolean;
  endpoint: string | null;
  verificationTokenConfigured: boolean;
  destinationId: string | null;
  subscriptionId: string | null;
  topicId: string | null;
  enabled: boolean;
  recentEvents: number;
  lastEventAt: string | null;
  detail: string;
};
