import { API_URL } from "../config";
import {
  InboxConnector,
  InboxSummary,
  UnifiedConversation,
} from "../types/inbox";

const FALLBACK_CONNECTORS: InboxConnector[] = [
  {
    platformId: "ebay",
    name: "eBay",
    mode: "api",
    connected: false,
    canReceive: false,
    canReply: false,
    detail: "eBay-Konto noch nicht verbunden.",
  },
  {
    platformId: "kleinanzeigen",
    name: "Kleinanzeigen",
    mode: "email_bridge_ready",
    connected: false,
    canReceive: false,
    canReply: false,
    detail: "Connector vorbereitet; keine verifizierte Nachrichten-API verbunden.",
  },
  {
    platformId: "facebook",
    name: "Facebook Marketplace",
    mode: "handoff",
    connected: false,
    canReceive: false,
    canReply: false,
    detail: "Noch keine verifizierte Marketplace-Inbox-API verbunden.",
  },
  {
    platformId: "vinted",
    name: "Vinted",
    mode: "handoff",
    connected: false,
    canReceive: false,
    canReply: false,
    detail: "Noch keine verifizierte Nachrichten-API verbunden.",
  },
  {
    platformId: "willhaben",
    name: "willhaben",
    mode: "handoff",
    connected: false,
    canReceive: false,
    canReply: false,
    detail: "Noch keine verifizierte Nachrichten-API verbunden.",
  },
  {
    platformId: "shpock",
    name: "Shpock",
    mode: "handoff",
    connected: false,
    canReceive: false,
    canReply: false,
    detail: "Noch keine verifizierte Nachrichten-API verbunden.",
  },
  {
    platformId: "quoka",
    name: "Quoka",
    mode: "handoff",
    connected: false,
    canReceive: false,
    canReply: false,
    detail: "Noch keine verifizierte Nachrichten-API verbunden.",
  },
  {
    platformId: "hood",
    name: "Hood.de",
    mode: "handoff",
    connected: false,
    canReceive: false,
    canReply: false,
    detail: "Noch keine verifizierte Nachrichten-API verbunden.",
  },
  {
    platformId: "markt",
    name: "markt.de",
    mode: "handoff",
    connected: false,
    canReceive: false,
    canReply: false,
    detail: "Noch keine verifizierte Nachrichten-API verbunden.",
  },
];

export async function loadInbox(): Promise<InboxSummary> {
  if (!API_URL) {
    return {
      total: 0,
      unread: 0,
      conversations: [],
      connectors: FALLBACK_CONNECTORS,
    };
  }

  const response = await fetch(`${API_URL}/messages/inbox`);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.error || `Nachrichten konnten nicht geladen werden (${response.status}).`
    );
  }

  return payload as InboxSummary;
}

export async function loadConversation(
  conversationId: string
): Promise<UnifiedConversation> {
  if (!API_URL) throw new Error("Backend ist nicht verbunden.");

  const response = await fetch(
    `${API_URL}/messages/ebay/conversation/${encodeURIComponent(conversationId)}`
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Konversation konnte nicht geladen werden.");
  }

  return payload as UnifiedConversation;
}

export async function sendInboxReply(
  conversationId: string,
  messageText: string
): Promise<void> {
  if (!API_URL) throw new Error("Backend ist nicht verbunden.");

  const response = await fetch(`${API_URL}/messages/ebay/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, messageText }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || "Nachricht konnte nicht gesendet werden.");
  }
}

export async function markConversationRead(
  conversationId: string
): Promise<void> {
  if (!API_URL) return;

  await fetch(`${API_URL}/messages/ebay/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId }),
  });
}
