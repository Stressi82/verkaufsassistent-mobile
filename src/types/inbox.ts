import { SalesPlatformId } from "./platform";

export type InboxConnectorMode = "api" | "handoff" | "email_bridge_ready";

export type InboxConnector = {
  platformId: SalesPlatformId;
  name: string;
  mode: InboxConnectorMode;
  connected: boolean;
  canReceive: boolean;
  canReply: boolean;
  detail: string;
};

export type UnifiedMessage = {
  id: string;
  direction: "inbound" | "outbound" | "system";
  body: string;
  sender: string;
  sentAt: string;
  read: boolean;
};

export type UnifiedConversation = {
  id: string;
  platformId: SalesPlatformId;
  externalConversationId?: string;
  listingExternalId?: string;
  listingTitle?: string;
  sender: string;
  subject: string;
  preview: string;
  lastMessageAt: string;
  unreadCount: number;
  messages?: UnifiedMessage[];
  sourceMode: InboxConnectorMode;
};

export type InboxSummary = {
  total: number;
  unread: number;
  conversations: UnifiedConversation[];
  connectors: InboxConnector[];
};
