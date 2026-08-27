import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  loadConversation,
  loadInbox,
  markConversationRead,
  sendInboxReply,
} from "../services/inbox";
import {
  buildBuyerMessageTemplates,
  offerReply,
} from "../services/buyerMessages";
import { ListingRecord } from "../types/salesCenter";
import {
  InboxSummary,
  UnifiedConversation,
} from "../types/inbox";
import { BuyerMessageTemplateId } from "../types/buyerMessages";
import { PushSetupPanel } from "./PushSetupPanel";

type Props = {
  listings: ListingRecord[];
  onBack: () => void;
  onConnectEbay: () => Promise<void>;
  initialConversationId?: string | null;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function findListing(
  conversation: UnifiedConversation,
  listings: ListingRecord[]
): ListingRecord | null {
  if (!conversation.listingExternalId) return null;

  return (
    listings.find((record) => {
      const publication = record.platformPublications?.[conversation.platformId];
      return (
        publication?.externalListingId === conversation.listingExternalId
      );
    }) || null
  );
}

export function InboxScreen({
  listings,
  onBack,
  onConnectEbay,
  initialConversationId,
}: Props) {
  const [summary, setSummary] = useState<InboxSummary | null>(null);
  const [selected, setSelected] = useState<UnifiedConversation | null>(null);
  const [busy, setBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [buyerOffer, setBuyerOffer] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    setBusy(true);
    setError("");
    try {
      setSummary(await loadInbox());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Nachrichten konnten nicht geladen werden."
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!initialConversationId || selected) return;

    setDetailBusy(true);
    loadConversation(initialConversationId)
      .then((detail) => {
        setSelected(detail);
        setReply("");
        setBuyerOffer("");
        if (detail.externalConversationId) {
          markConversationRead(detail.externalConversationId).catch(
            () => undefined
          );
        }
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : "Push-Konversation konnte nicht geladen werden."
        );
      })
      .finally(() => setDetailBusy(false));
  }, [initialConversationId]);

  const listing = useMemo(
    () => (selected ? findListing(selected, listings) : null),
    [selected, listings]
  );

  const templates = useMemo(
    () => (listing ? buildBuyerMessageTemplates(listing) : []),
    [listing]
  );

  const openConversation = async (conversation: UnifiedConversation) => {
    if (!conversation.externalConversationId) return;

    setDetailBusy(true);
    setError("");
    try {
      const detail = await loadConversation(conversation.externalConversationId);
      setSelected(detail);
      setReply("");
      setBuyerOffer("");

      if (detail.unreadCount > 0) {
        markConversationRead(detail.externalConversationId || "").catch(
          () => undefined
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Konversation konnte nicht geladen werden."
      );
    } finally {
      setDetailBusy(false);
    }
  };

  const chooseOfferReply = (
    type: Extract<
      BuyerMessageTemplateId,
      "offer_accept" | "offer_decline" | "offer_counter"
    >
  ) => {
    if (!listing) return;
    const template = offerReply(listing, type, buyerOffer);
    if (!template.available) {
      Alert.alert("Preisangebot", template.reason || "Vorlage nicht verfügbar.");
      return;
    }
    setReply(template.text);
  };

  const confirmSend = () => {
    if (!selected?.externalConversationId) return;
    if (!reply.trim()) {
      Alert.alert("Nachricht", "Bitte zuerst eine Antwort eingeben.");
      return;
    }

    Alert.alert(
      "Nachricht senden?",
      "Die Antwort wird wirklich an den Käufer über eBay gesendet.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Senden",
          onPress: async () => {
            setSendBusy(true);
            try {
              await sendInboxReply(
                selected.externalConversationId!,
                reply.trim()
              );
              setReply("");
              const updated = await loadConversation(
                selected.externalConversationId!
              );
              setSelected(updated);
              refresh().catch(() => undefined);
              Alert.alert("Gesendet", "Die Nachricht wurde an eBay übergeben.");
            } catch (err) {
              Alert.alert(
                "Senden fehlgeschlagen",
                err instanceof Error ? err.message : "Nachricht konnte nicht gesendet werden."
              );
            } finally {
              setSendBusy(false);
            }
          },
        },
      ]
    );
  };

  if (selected) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable style={styles.backInline} onPress={() => setSelected(null)}>
          <Text style={styles.backInlineText}>‹ Alle Nachrichten</Text>
        </Pressable>

        <Text style={styles.eyebrow}>EBAY-KONVERSATION</Text>
        <Text style={styles.title}>{selected.subject || "Nachricht"}</Text>
        <Text style={styles.muted}>
          {selected.sender}
          {selected.listingTitle ? ` · ${selected.listingTitle}` : ""}
        </Text>

        {listing ? (
          <View style={styles.listingCard}>
            <Text style={styles.listingEyebrow}>ZUGEORDNETER ARTIKEL</Text>
            <Text style={styles.listingTitle}>{listing.draft.title}</Text>
            <Text style={styles.listingMeta}>
              {listing.draft.price
                ? `${listing.draft.price} € ${listing.draft.priceType}`
                : "Preis offen"}{" "}
              · Status {listing.status}
            </Text>
          </View>
        ) : (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Artikel nicht automatisch zugeordnet</Text>
            <Text style={styles.infoText}>
              Die eBay-Konversation ist sichtbar, aber ihre Listing-ID ist noch
              keinem lokal gespeicherten Artikel zugeordnet. Freie Antworten sind
              trotzdem möglich.
            </Text>
          </View>
        )}

        <View style={styles.thread}>
          {(selected.messages || []).map((message) => (
            <View
              key={message.id}
              style={[
                styles.bubble,
                message.direction === "outbound"
                  ? styles.bubbleOut
                  : styles.bubbleIn,
              ]}
            >
              <Text style={styles.sender}>{message.sender}</Text>
              <Text style={styles.messageBody}>{message.body}</Text>
              <Text style={styles.messageDate}>{formatDate(message.sentAt)}</Text>
            </View>
          ))}

          {(selected.messages || []).length === 0 && (
            <Text style={styles.threadEmptyText}>
              eBay hat für diese Konversation aktuell keine Detailnachrichten geliefert.
            </Text>
          )}
        </View>

        {listing && (
          <View style={styles.templateCard}>
            <Text style={styles.sectionTitle}>Schnellantworten</Text>
            <Text style={styles.sectionText}>
              Die Vorlagen verwenden nur Daten, die beim Artikel wirklich hinterlegt sind.
            </Text>

            <View style={styles.wrap}>
              {templates.map((template) => (
                <Pressable
                  key={template.id}
                  disabled={!template.available}
                  onPress={() => setReply(template.text)}
                  style={[
                    styles.templateChip,
                    !template.available && styles.templateDisabled,
                  ]}
                >
                  <Text style={styles.templateChipText}>{template.title}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Angebot des Käufers optional</Text>
            <TextInput
              value={buyerOffer}
              onChangeText={setBuyerOffer}
              keyboardType="decimal-pad"
              placeholder="z. B. 55"
              style={styles.offerInput}
            />
            <View style={styles.wrap}>
              <Pressable
                style={styles.templateChip}
                onPress={() => chooseOfferReply("offer_accept")}
              >
                <Text style={styles.templateChipText}>Annehmen</Text>
              </Pressable>
              <Pressable
                style={styles.templateChip}
                onPress={() => chooseOfferReply("offer_decline")}
              >
                <Text style={styles.templateChipText}>Ablehnen</Text>
              </Pressable>
              <Pressable
                style={styles.templateChip}
                onPress={() => chooseOfferReply("offer_counter")}
              >
                <Text style={styles.templateChipText}>Gegenangebot</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.composeCard}>
          <Text style={styles.sectionTitle}>Antwort</Text>
          <TextInput
            multiline
            value={reply}
            onChangeText={setReply}
            placeholder="Antwort eingeben oder Schnellvorlage wählen …"
            style={styles.replyInput}
          />
          <Text style={styles.charCount}>{reply.length}/2000</Text>

          <Pressable
            disabled={sendBusy || !reply.trim() || reply.length > 2000}
            onPress={confirmSend}
            style={[
              styles.sendButton,
              (sendBusy || !reply.trim() || reply.length > 2000) &&
                styles.disabled,
            ]}
          >
            <Text style={styles.sendText}>
              {sendBusy ? "Wird gesendet …" : "Nachricht senden"}
            </Text>
          </Pressable>

          <Text style={styles.safety}>
            Es wird nie automatisch geantwortet. Erst dein Tippen auf
            „Nachricht senden“ und die anschließende Bestätigung lösen den Versand aus.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>NACHRICHTEN-ZENTRALE</Text>
          <Text style={styles.title}>Alle Anfragen</Text>
          <Text style={styles.muted}>
            Eine Oberfläche für Käuferfragen. Plattformen werden nur dann als
            verbunden angezeigt, wenn der Connector wirklich funktioniert.
          </Text>
        </View>
        {summary && summary.unread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{summary.unread}</Text>
          </View>
        )}
      </View>

      <View style={styles.connectorCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Connectoren</Text>
          <Pressable onPress={refresh}>
            <Text style={styles.refreshText}>Aktualisieren</Text>
          </Pressable>
        </View>

        {(summary?.connectors || []).map((connector) => (
          <View key={connector.platformId} style={styles.connectorRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.connectorName}>{connector.name}</Text>
              <Text style={styles.connectorText}>{connector.detail}</Text>
            </View>
            <Text
              style={[
                styles.connectorStatus,
                connector.canReceive
                  ? styles.connectorReady
                  : styles.connectorPending,
              ]}
            >
              {connector.canReceive
                ? "INBOX ✓"
                : connector.mode === "api"
                  ? "nicht verbunden"
                  : "vorbereitet"}
            </Text>
          </View>
        ))}

        {summary?.connectors.find(
          (connector) =>
            connector.platformId === "ebay" && !connector.connected
        ) && (
          <Pressable
            style={styles.connectButton}
            onPress={async () => {
              try {
                await onConnectEbay();
              } catch (err) {
                Alert.alert(
                  "eBay",
                  err instanceof Error ? err.message : "eBay konnte nicht verbunden werden."
                );
              }
            }}
          >
            <Text style={styles.connectText}>eBay verbinden</Text>
          </Pressable>
        )}
      </View>

      <PushSetupPanel />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Konversationen</Text>
        {busy && <ActivityIndicator />}
      </View>

      {!busy && (summary?.conversations.length || 0) === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Noch keine zentralen Anfragen</Text>
          <Text style={styles.emptyText}>
            eBay-Nachrichten erscheinen hier nach erfolgreicher OAuth-Verbindung.
            Die anderen Plattformconnectoren sind sichtbar vorbereitet, aber noch
            nicht als echte Nachrichtenquelle freigeschaltet.
          </Text>
        </View>
      )}

      {(summary?.conversations || []).map((conversation) => (
        <Pressable
          key={conversation.id}
          onPress={() => openConversation(conversation)}
          style={styles.conversation}
        >
          <View style={styles.rowBetween}>
            <Text style={styles.platformBadge}>eBay</Text>
            <Text style={styles.date}>{formatDate(conversation.lastMessageAt)}</Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.conversationTitle} numberOfLines={1}>
              {conversation.subject || conversation.listingTitle || "eBay-Anfrage"}
            </Text>
            {conversation.unreadCount > 0 && (
              <View style={styles.smallUnread}>
                <Text style={styles.smallUnreadText}>{conversation.unreadCount}</Text>
              </View>
            )}
          </View>

          <Text style={styles.senderLine}>{conversation.sender}</Text>
          <Text style={styles.preview} numberOfLines={2}>
            {conversation.preview}
          </Text>
        </Pressable>
      ))}

      {detailBusy && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Konversation wird geladen …</Text>
        </View>
      )}

      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backText}>Zur Verkaufszentrale</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 50, backgroundColor: "#f6f6f4" },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2, color: "#666" },
  title: { fontSize: 30, lineHeight: 35, fontWeight: "900", marginTop: 5 },
  muted: { color: "#666", lineHeight: 20, marginTop: 6 },
  headerRow: { flexDirection: "row", gap: 10 },
  unreadBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#171717",
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: { color: "#fff", fontWeight: "900" },
  connectorCard: {
    marginTop: 15,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 17,
    padding: 14,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
  },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#222" },
  sectionText: { color: "#666", lineHeight: 17, fontSize: 11, marginTop: 4 },
  refreshText: { fontSize: 11, fontWeight: "900", color: "#444" },
  connectorRow: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 10,
    marginTop: 10,
  },
  connectorName: { fontWeight: "900", color: "#222" },
  connectorText: { color: "#777", fontSize: 10, lineHeight: 15, marginTop: 2 },
  connectorStatus: {
    fontSize: 9,
    fontWeight: "900",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  connectorReady: { backgroundColor: "#eaf4e8", color: "#2f6333" },
  connectorPending: { backgroundColor: "#eee", color: "#666" },
  connectButton: {
    backgroundColor: "#171717",
    borderRadius: 11,
    padding: 11,
    alignItems: "center",
    marginTop: 12,
  },
  connectText: { color: "#fff", fontWeight: "900" },
  errorBox: { backgroundColor: "#fff0eb", borderRadius: 11, padding: 10, marginTop: 12 },
  errorText: { color: "#8a3024", fontSize: 11, lineHeight: 16 },
  conversation: {
    marginTop: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 15,
    padding: 12,
  },
  platformBadge: {
    backgroundColor: "#171717",
    color: "#fff",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "900",
  },
  date: { color: "#888", fontSize: 9 },
  conversationTitle: { flex: 1, fontWeight: "900", marginTop: 8 },
  senderLine: { color: "#555", fontSize: 11, marginTop: 4 },
  preview: { color: "#777", fontSize: 11, lineHeight: 16, marginTop: 5 },
  smallUnread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#171717",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 7,
  },
  smallUnreadText: { color: "#fff", fontWeight: "900", fontSize: 9 },
  emptyBox: { backgroundColor: "#fff", borderRadius: 15, padding: 15, marginTop: 10 },
  emptyTitle: { fontWeight: "900" },
  emptyText: { color: "#666", lineHeight: 17, fontSize: 11, marginTop: 4 },
  loadingOverlay: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  loadingText: { color: "#666", fontSize: 11 },
  backButton: {
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 13,
    padding: 12,
    alignItems: "center",
    marginTop: 15,
  },
  backText: { fontWeight: "800", color: "#333" },
  backInline: { marginBottom: 12 },
  backInlineText: { color: "#444", fontWeight: "900" },
  listingCard: {
    marginTop: 13,
    backgroundColor: "#171717",
    borderRadius: 14,
    padding: 13,
  },
  listingEyebrow: { color: "#aaa", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  listingTitle: { color: "#fff", fontWeight: "900", marginTop: 4 },
  listingMeta: { color: "#ccc", fontSize: 10, marginTop: 3 },
  infoBox: { backgroundColor: "#fff6e8", borderRadius: 12, padding: 11, marginTop: 12 },
  infoTitle: { color: "#76531f", fontWeight: "900" },
  infoText: { color: "#765f3e", fontSize: 11, lineHeight: 16, marginTop: 3 },
  thread: { marginTop: 14 },
  bubble: { maxWidth: "88%", borderRadius: 14, padding: 11, marginTop: 8 },
  bubbleIn: { alignSelf: "flex-start", backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd" },
  bubbleOut: { alignSelf: "flex-end", backgroundColor: "#171717" },
  sender: { fontSize: 9, fontWeight: "900", color: "#777" },
  messageBody: { color: "#333", lineHeight: 18, marginTop: 4 },
  messageDate: { color: "#888", fontSize: 9, marginTop: 5 },
  threadEmptyText: { color: "#777", fontSize: 11, lineHeight: 16 },
  templateCard: {
    marginTop: 15,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 16,
    padding: 13,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 9 },
  templateChip: {
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  templateDisabled: { opacity: 0.3 },
  templateChipText: { fontSize: 10, fontWeight: "800", color: "#333" },
  label: { fontSize: 11, fontWeight: "900", color: "#444", marginTop: 12 },
  offerInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
  },
  composeCard: {
    marginTop: 15,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#171717",
    borderRadius: 16,
    padding: 13,
  },
  replyInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 11,
    padding: 11,
    marginTop: 9,
    textAlignVertical: "top",
  },
  charCount: { color: "#888", fontSize: 9, textAlign: "right", marginTop: 4 },
  sendButton: {
    backgroundColor: "#171717",
    borderRadius: 11,
    padding: 12,
    alignItems: "center",
    marginTop: 9,
  },
  sendText: { color: "#fff", fontWeight: "900" },
  disabled: { opacity: 0.4 },
  safety: { color: "#888", fontSize: 9, lineHeight: 14, marginTop: 8 },
});
