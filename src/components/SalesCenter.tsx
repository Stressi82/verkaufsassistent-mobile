import React, { useMemo } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ListingRecord } from "../types/salesCenter";
import {
  LISTING_STATUS_LABELS,
  ListingStatus,
} from "../types/lifecycle";
import { followUpSuggestion } from "../services/salesIntelligence";

type Props = {
  listings: ListingRecord[];
  onNew: () => void;
  onBatch: () => void;
  onInbox: () => void;
  onSettings: () => void;
  onCleanup: (record: ListingRecord) => void;
  onOpen: (record: ListingRecord) => void;
  onSetStatus: (record: ListingRecord, status: ListingStatus) => void;
  onDelete: (record: ListingRecord) => void;
  onLoadDemo: () => void;
};

export function SalesCenter({
  listings,
  onNew,
  onBatch,
  onInbox,
  onSettings,
  onCleanup,
  onOpen,
  onSetStatus,
  onDelete,
  onLoadDemo,
}: Props) {
  const counts = useMemo(
    () => ({
      draft: listings.filter((item) => item.status === "draft").length,
      prepared: listings.filter((item) => item.status === "prepared").length,
      online: listings.filter((item) => item.status === "online").length,
      reserved: listings.filter((item) => item.status === "reserved").length,
      sold: listings.filter((item) => item.status === "sold").length,
      removed: listings.filter((item) => item.status === "removed").length,
    }),
    [listings]
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>VERKAUFSZENTRALE</Text>
      <Text style={styles.title}>Deine Verkäufe</Text>
      <Text style={styles.muted}>
        Entwürfe, aktive Anzeigen und verkaufte Artikel an einem Ort.
      </Text>

      <Pressable style={styles.newButton} onPress={onNew}>
        <Text style={styles.newButtonText}>＋ Neuer Artikel</Text>
      </Pressable>

      <Pressable style={styles.batchButton} onPress={onBatch}>
        <Text style={styles.batchButtonText}>▦ Stapelverkauf</Text>
        <Text style={styles.batchButtonSub}>
          Mehrere Gegenstände hintereinander erfassen
        </Text>
      </Pressable>

      <Pressable style={styles.inboxButton} onPress={onInbox}>
        <Text style={styles.inboxButtonText}>✉ Nachrichten-Zentrale</Text>
        <Text style={styles.inboxButtonSub}>
          Käuferanfragen zentral lesen und beantworten
        </Text>
      </Pressable>

      <Pressable style={styles.settingsButton} onPress={onSettings}>
        <Text style={styles.settingsButtonText}>⚙ Persönliche Standards</Text>
      </Pressable>

      <View style={styles.countGrid}>
        <Count label="Entwürfe" value={counts.draft} />
        <Count label="Vorbereitet" value={counts.prepared} />
        <Count label="Online" value={counts.online} />
        <Count label="Reserviert" value={counts.reserved} />
        <Count label="Verkauft" value={counts.sold} />
        <Count label="Entfernt" value={counts.removed} />
      </View>

      {listings.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Noch keine Artikel</Text>
          <Text style={styles.emptyText}>
            Erstelle deinen ersten Artikel oder lade Beispieldaten für einen Soforttest.
          </Text>
          <Pressable style={styles.secondary} onPress={onLoadDemo}>
            <Text style={styles.secondaryText}>Demo-Verkaufszentrale füllen</Text>
          </Pressable>
        </View>
      ) : (
        listings.map((record) => {
          const followUp = followUpSuggestion(record);

          return (
          <View key={record.id} style={styles.card}>
            <View style={styles.row}>
              {record.photos[0]?.uri ? (
                <Image source={{ uri: record.photos[0].uri }} style={styles.image} />
              ) : (
                <View style={[styles.image, styles.imagePlaceholder]}>
                  <Text>📦</Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <View style={styles.statusRow}>
                  <Text style={styles.status}>{LISTING_STATUS_LABELS[record.status]}</Text>
                  <Text style={styles.date}>
                    {new Date(record.updatedAt).toLocaleDateString("de-DE")}
                  </Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {record.draft.title || "Unbenannter Artikel"}
                </Text>
                <Text style={styles.price}>
                  {record.draft.price
                    ? `${record.draft.price} € ${record.draft.priceType}`
                    : "Preis offen"}
                </Text>
                {record.priceHistory && record.priceHistory.length > 1 && (
                  <Text style={styles.historyText}>
                    Preisänderungen: {record.priceHistory.length - 1}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.platforms}>
              {record.photoAudit &&
                (!record.photoAudit.privacyScanComplete ||
                  record.photoAudit.hasBlockingPrivacyRisk) &&
                !record.privacyAcknowledged && (
                  <View style={styles.warningChip}>
                    <Text style={styles.warningChipText}>Foto prüfen ⚠</Text>
                  </View>
                )}

              {record.shippingSelection && (
                <View style={styles.shippingChip}>
                  <Text style={styles.shippingChipText}>
                    📦 {record.shippingSelection.carrier} ·{" "}
                    {record.shippingSelection.price.toFixed(2).replace(".", ",")} €
                  </Text>
                </View>
              )}

              {Object.entries(record.platformStatuses).map(([id, status]) => (
                <View key={id} style={styles.platformChip}>
                  <Text style={styles.platformText}>
                    {id}{" "}
                    {status === "online"
                      ? "✓"
                      : status === "sold"
                        ? "●"
                        : status === "removed"
                          ? "×"
                          : "○"}
                  </Text>
                </View>
              ))}
            </View>

            {followUp && (
              <View
                style={[
                  styles.followUp,
                  followUp.level === "strong" && styles.followUpStrong,
                ]}
              >
                <Text style={styles.followUpTitle}>{followUp.title}</Text>
                <Text style={styles.followUpText}>{followUp.text}</Text>
              </View>
            )}

            <View style={styles.actions}>
              <Pressable style={styles.action} onPress={() => onOpen(record)}>
                <Text style={styles.actionText}>Bearbeiten</Text>
              </Pressable>

              {record.status === "draft" && (
                <Pressable style={styles.action} onPress={() => onSetStatus(record, "prepared")}>
                  <Text style={styles.actionText}>Vorbereitet</Text>
                </Pressable>
              )}

              {record.status === "prepared" && (
                <Pressable style={styles.action} onPress={() => onSetStatus(record, "online")}>
                  <Text style={styles.actionText}>Online</Text>
                </Pressable>
              )}

              {record.status === "online" && (
                <>
                  <Pressable style={styles.action} onPress={() => onSetStatus(record, "reserved")}>
                    <Text style={styles.actionText}>Reserviert</Text>
                  </Pressable>
                  <Pressable style={styles.action} onPress={() => onSetStatus(record, "sold")}>
                    <Text style={styles.actionText}>Verkauft</Text>
                  </Pressable>
                </>
              )}

              {record.status === "reserved" && (
                <>
                  <Pressable style={styles.action} onPress={() => onSetStatus(record, "online")}>
                    <Text style={styles.actionText}>Wieder online</Text>
                  </Pressable>
                  <Pressable style={styles.action} onPress={() => onSetStatus(record, "sold")}>
                    <Text style={styles.actionText}>Verkauft</Text>
                  </Pressable>
                </>
              )}

              {record.status === "sold" && (
                <>
                  <Pressable style={styles.action} onPress={() => onCleanup(record)}>
                    <Text style={styles.actionText}>Verkauf abschließen</Text>
                  </Pressable>
                  <Pressable style={styles.action} onPress={() => onSetStatus(record, "online")}>
                    <Text style={styles.actionText}>Wieder online</Text>
                  </Pressable>
                </>
              )}

              {record.status !== "removed" && (
                <Pressable style={styles.action} onPress={() => onSetStatus(record, "removed")}>
                  <Text style={[styles.actionText, styles.deleteText]}>Entfernt</Text>
                </Pressable>
              )}

              {record.status === "removed" && (
                <Pressable style={styles.action} onPress={() => onSetStatus(record, "draft")}>
                  <Text style={styles.actionText}>Als Entwurf reaktivieren</Text>
                </Pressable>
              )}

              <Pressable
                style={styles.action}
                onPress={() =>
                  Alert.alert(
                    "Artikel endgültig löschen?",
                    "Der Artikel wird vollständig aus der Verkaufszentrale entfernt. Dieser Schritt ist nicht dasselbe wie der Lebenszyklus-Status „Entfernt“.",
                    [
                      { text: "Abbrechen", style: "cancel" },
                      {
                        text: "Endgültig löschen",
                        style: "destructive",
                        onPress: () => onDelete(record),
                      },
                    ]
                  )
                }
              >
                <Text style={[styles.actionText, styles.deleteText]}>Löschen</Text>
              </Pressable>
            </View>
          </View>
          );
        })
      )}
    </ScrollView>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.count}>
      <Text style={styles.countValue}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 50, backgroundColor: "#f6f6f4" },
  eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1.3, color: "#666" },
  title: { fontSize: 31, lineHeight: 36, fontWeight: "900", color: "#171717", marginTop: 6 },
  muted: { color: "#666", lineHeight: 21, marginTop: 7 },
  newButton: {
    backgroundColor: "#171717",
    borderRadius: 16,
    padding: 17,
    marginTop: 20,
    alignItems: "center",
  },
  newButtonText: { color: "#fff", fontWeight: "900", fontSize: 17 },
  batchButton: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#171717",
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    alignItems: "center",
  },
  batchButtonText: { color: "#171717", fontWeight: "900", fontSize: 16 },
  batchButtonSub: { color: "#666", fontSize: 11, marginTop: 3 },
  inboxButton: {
    backgroundColor: "#171717",
    borderRadius: 14,
    padding: 13,
    alignItems: "center",
    marginTop: 9,
  },
  inboxButtonText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  inboxButtonSub: { color: "#bbb", fontSize: 10, marginTop: 3 },
  settingsButton: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    marginTop: 9,
  },
  settingsButtonText: { fontWeight: "900", color: "#333" },
  countGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 16,
  },
  count: {
    width: "31%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dedede",
    borderRadius: 15,
    padding: 13,
    alignItems: "center",
  },
  countValue: { fontSize: 25, fontWeight: "900", color: "#171717" },
  countLabel: { fontSize: 11, fontWeight: "800", color: "#666", marginTop: 2 },
  empty: {
    marginTop: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dedede",
    borderRadius: 18,
    padding: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: "900" },
  emptyText: { color: "#666", lineHeight: 20, marginTop: 6 },
  secondary: {
    borderWidth: 1,
    borderColor: "#c7c7c7",
    borderRadius: 13,
    padding: 12,
    alignItems: "center",
    marginTop: 14,
  },
  secondaryText: { fontWeight: "800", color: "#222" },
  card: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dedede",
    borderRadius: 18,
    padding: 14,
  },
  row: { flexDirection: "row", gap: 12 },
  image: { width: 88, height: 88, borderRadius: 13, backgroundColor: "#eee" },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  statusRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  status: {
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: "#efefed",
    borderRadius: 999,
    overflow: "hidden",
  },
  date: { fontSize: 10, color: "#888" },
  cardTitle: { fontWeight: "900", fontSize: 16, marginTop: 8, color: "#222" },
  price: { fontWeight: "800", color: "#555", marginTop: 5 },
  platforms: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  platformChip: {
    backgroundColor: "#f3f3f1",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  platformText: { fontSize: 10, fontWeight: "800", color: "#555" },
  warningChip: {
    backgroundColor: "#fff0eb",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  warningChipText: { fontSize: 10, fontWeight: "900", color: "#922e21" },
  shippingChip: {
    backgroundColor: "#edf3f7",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  shippingChipText: { fontSize: 10, fontWeight: "900", color: "#365368" },
  followUp: {
    marginTop: 11,
    backgroundColor: "#fff7e9",
    borderRadius: 11,
    padding: 10,
  },
  followUpStrong: {
    backgroundColor: "#fff0eb",
  },
  followUpTitle: { fontWeight: "900", color: "#704b1e" },
  followUpText: { color: "#6d5c45", lineHeight: 17, fontSize: 11, marginTop: 3 },
  historyText: { color: "#888", fontSize: 10, marginTop: 3 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  action: {
    borderWidth: 1,
    borderColor: "#d0d0d0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionText: { fontSize: 12, fontWeight: "800", color: "#333" },
  deleteText: { color: "#9f1d1d" },
});
