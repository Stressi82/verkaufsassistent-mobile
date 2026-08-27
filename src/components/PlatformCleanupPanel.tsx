import React, { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SALES_PLATFORMS } from "../services/platforms";
import { withdrawEbayOffer } from "../services/ebayPublish";
import { ListingRecord, PlatformListingStatus } from "../types/salesCenter";
import { SalesPlatformId } from "../types/platform";
import { SaleSource } from "../types/platformCleanup";

type Props = {
  record: ListingRecord;
  onUpdate: (record: ListingRecord) => Promise<void>;
  onBack: () => void;
};

function platformName(id: SalesPlatformId): string {
  return SALES_PLATFORMS.find((platform) => platform.id === id)?.name || id;
}

function isStillActive(status?: PlatformListingStatus): boolean {
  return status === "online";
}

export function PlatformCleanupPanel({
  record,
  onUpdate,
  onBack,
}: Props) {
  const [busyPlatform, setBusyPlatform] = useState<SalesPlatformId | null>(null);

  const selectedPlatformIds = useMemo(
    () =>
      Object.keys(record.platformStatuses) as SalesPlatformId[],
    [record.platformStatuses]
  );

  const activeIds = useMemo(
    () =>
      selectedPlatformIds.filter((id) =>
        isStillActive(record.platformStatuses[id])
      ),
    [record.platformStatuses, selectedPlatformIds]
  );

  const cleanupIds = useMemo(
    () =>
      activeIds.filter(
        (id) => record.saleSource == null || record.saleSource !== id
      ),
    [activeIds, record.saleSource]
  );

  const setSaleSource = async (source: SaleSource) => {
    const nextStatuses = { ...record.platformStatuses };

    if (
      record.saleSource &&
      record.saleSource !== "offline" &&
      record.saleSource !== source &&
      nextStatuses[record.saleSource] === "sold"
    ) {
      nextStatuses[record.saleSource] = "online";
    }

    if (source !== "offline") {
      nextStatuses[source] = "sold";
    }

    const next = {
      ...record,
      saleSource: source,
      platformStatuses: nextStatuses,
      updatedAt: new Date().toISOString(),
    };

    await onUpdate(next);
  };

  const markRemoved = async (platformId: SalesPlatformId) => {
    const now = new Date().toISOString();
    const publication = record.platformPublications?.[platformId];

    await onUpdate({
      ...record,
      updatedAt: now,
      platformStatuses: {
        ...record.platformStatuses,
        [platformId]: "removed",
      },
      platformPublications: publication
        ? {
            ...record.platformPublications,
            [platformId]: {
              ...publication,
              state: "removed",
              removedAt: now,
            },
          }
        : record.platformPublications,
    });
  };

  const withdrawEbay = async () => {
    const publication = record.platformPublications?.ebay;
    const offerId = publication?.externalOfferId;

    if (!offerId) {
      Alert.alert(
        "eBay",
        "Für dieses Angebot ist keine gespeicherte eBay Offer-ID vorhanden. Bitte eBay manuell öffnen und die Anzeige dort prüfen."
      );
      return;
    }

    setBusyPlatform("ebay");
    try {
      const result = await withdrawEbayOffer(offerId);
      await markRemoved("ebay");

      Alert.alert(
        "eBay beendet",
        [
          "Das eBay-Angebot wurde aus der aktiven Veröffentlichung zurückgezogen.",
          result.listingId ? `Listing-ID: ${result.listingId}` : "",
          result.warnings?.length
            ? `Hinweis: ${result.warnings.join(" · ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
    } catch (error) {
      Alert.alert(
        "eBay beenden",
        error instanceof Error
          ? error.message
          : "eBay-Angebot konnte nicht beendet werden."
      );
    } finally {
      setBusyPlatform(null);
    }
  };

  const openPlatform = async (platformId: SalesPlatformId) => {
    const publication = record.platformPublications?.[platformId];
    const platform = SALES_PLATFORMS.find((entry) => entry.id === platformId);
    const url = publication?.listingUrl || platform?.sellUrl;

    if (!url) {
      Alert.alert("Plattform", "Für diese Plattform ist kein Link hinterlegt.");
      return;
    }

    await Linking.openURL(url);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>VERKAUF ABSCHLIESSEN</Text>
      <Text style={styles.title}>Andere Anzeigen aufräumen</Text>
      <Text style={styles.muted}>
        Der Artikel ist verkauft. Jetzt prüfen wir getrennt, auf welchen
        Plattformen die Anzeige technisch noch aktiv ist.
      </Text>

      <View style={styles.itemCard}>
        <Text style={styles.itemTitle}>{record.draft.title}</Text>
        <Text style={styles.itemMeta}>
          {record.draft.price
            ? `${record.draft.price} € ${record.draft.priceType}`
            : "Preis offen"}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Wo wurde verkauft?</Text>
        <Text style={styles.cardText}>
          Damit die Verkaufsplattform selbst nicht fälschlich als
          „zu entfernen“ behandelt wird.
        </Text>

        <View style={styles.chips}>
          {selectedPlatformIds.map((platformId) => (
            <Pressable
              key={platformId}
              onPress={() => setSaleSource(platformId)}
              style={[
                styles.chip,
                record.saleSource === platformId && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  record.saleSource === platformId && styles.chipTextActive,
                ]}
              >
                {platformName(platformId)}
              </Text>
            </Pressable>
          ))}

          <Pressable
            onPress={() => setSaleSource("offline")}
            style={[
              styles.chip,
              record.saleSource === "offline" && styles.chipActive,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                record.saleSource === "offline" && styles.chipTextActive,
              ]}
            >
              Außerhalb der Plattformen
            </Text>
          </Pressable>
        </View>
      </View>

      {!record.saleSource && (
        <View style={styles.warning}>
          <Text style={styles.warningTitle}>Verkaufsquelle noch offen</Text>
          <Text style={styles.warningText}>
            Wähle zuerst, wo der Artikel verkauft wurde. Danach kann die App
            eindeutig zeigen, welche anderen Anzeigen noch entfernt werden müssen.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Plattformstatus</Text>
          <Text style={styles.counter}>
            {cleanupIds.length} offen
          </Text>
        </View>

        {selectedPlatformIds.length === 0 && (
          <Text style={styles.cardText}>
            Für diesen Artikel sind keine Plattformen gespeichert.
          </Text>
        )}

        {selectedPlatformIds.map((platformId) => {
          const status = record.platformStatuses[platformId] || "not_selected";
          const isSaleSource = record.saleSource === platformId;
          const publication = record.platformPublications?.[platformId];
          const canAutoWithdraw =
            platformId === "ebay" &&
            Boolean(publication?.externalOfferId) &&
            status === "online" &&
            !isSaleSource;

          return (
            <View key={platformId} style={styles.platformRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.platformName}>
                    {platformName(platformId)}
                  </Text>
                  <Text
                    style={[
                      styles.status,
                      status === "online" && styles.statusOnline,
                      status === "removed" && styles.statusDone,
                      status === "sold" && styles.statusDone,
                    ]}
                  >
                    {isSaleSource
                      ? "VERKAUFSQUELLE"
                      : status.toUpperCase()}
                  </Text>
                </View>

                {publication?.externalListingId && (
                  <Text style={styles.meta}>
                    Listing {publication.externalListingId}
                  </Text>
                )}

                {isSaleSource ? (
                  <Text style={styles.explanation}>
                    Hier wurde verkauft. Diese Plattform wird nicht als
                    Restanzeige behandelt.
                  </Text>
                ) : status === "online" ? (
                  <Text style={styles.explanation}>
                    Diese Anzeige ist nach unserem gespeicherten Status noch aktiv
                    und sollte beendet werden.
                  </Text>
                ) : status === "removed" ? (
                  <Text style={styles.doneText}>Erledigt ✓</Text>
                ) : (
                  <Text style={styles.explanation}>
                    Kein aktiver Reststatus gespeichert.
                  </Text>
                )}
              </View>

              {!isSaleSource && status === "online" && (
                <View style={styles.actionArea}>
                  {canAutoWithdraw ? (
                    <Pressable
                      disabled={busyPlatform === platformId}
                      onPress={withdrawEbay}
                      style={styles.apiButton}
                    >
                      <Text style={styles.apiButtonText}>
                        {busyPlatform === platformId
                          ? "eBay wird beendet …"
                          : "Automatisch beenden"}
                      </Text>
                    </Pressable>
                  ) : (
                    <>
                      <Pressable
                        onPress={() => openPlatform(platformId)}
                        style={styles.openButton}
                      >
                        <Text style={styles.openButtonText}>
                          Plattform öffnen
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => markRemoved(platformId)}
                        style={styles.confirmButton}
                      >
                        <Text style={styles.confirmButtonText}>
                          Als entfernt bestätigen
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {record.saleSource && cleanupIds.length === 0 && (
        <View style={styles.success}>
          <Text style={styles.successTitle}>Verkauf abgeschlossen ✓</Text>
          <Text style={styles.successText}>
            Nach den gespeicherten Plattformstatus ist keine fremde aktive
            Restanzeige mehr offen.
          </Text>
        </View>
      )}

      <Text style={styles.note}>
        eBay kann automatisch über die Inventory API zurückgezogen werden,
        wenn Offer-ID und verbundenes eBay-Konto vorhanden sind. Andere
        Plattformen werden erst dann als entfernt gespeichert, wenn du dies
        bewusst bestätigst.
      </Text>

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
  muted: { color: "#666", lineHeight: 21, marginTop: 7 },
  itemCard: {
    marginTop: 14,
    backgroundColor: "#171717",
    borderRadius: 15,
    padding: 14,
  },
  itemTitle: { color: "#fff", fontWeight: "900", fontSize: 16 },
  itemMeta: { color: "#ccc", marginTop: 4 },
  card: {
    marginTop: 13,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 17,
    padding: 14,
  },
  cardTitle: { fontSize: 17, fontWeight: "900" },
  cardText: { color: "#666", fontSize: 12, lineHeight: 17, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  chip: {
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: "#171717", borderColor: "#171717" },
  chipText: { fontSize: 10, fontWeight: "800", color: "#333" },
  chipTextActive: { color: "#fff" },
  warning: {
    marginTop: 12,
    backgroundColor: "#fff6e7",
    borderRadius: 12,
    padding: 11,
  },
  warningTitle: { fontWeight: "900", color: "#75511f" },
  warningText: { color: "#755f3f", fontSize: 11, lineHeight: 16, marginTop: 3 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  counter: {
    fontSize: 10,
    fontWeight: "900",
    color: "#fff",
    backgroundColor: "#171717",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  platformRow: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
    marginTop: 12,
  },
  platformName: { fontWeight: "900", color: "#222" },
  status: {
    fontSize: 9,
    fontWeight: "900",
    color: "#555",
    backgroundColor: "#eee",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  statusOnline: { backgroundColor: "#fff0e6", color: "#8b4b1d" },
  statusDone: { backgroundColor: "#eaf4e8", color: "#2f6333" },
  meta: { color: "#888", fontSize: 10, marginTop: 3 },
  explanation: { color: "#666", fontSize: 11, lineHeight: 16, marginTop: 5 },
  doneText: { color: "#2f6333", fontWeight: "900", marginTop: 5, fontSize: 11 },
  actionArea: { marginTop: 9 },
  apiButton: {
    backgroundColor: "#171717",
    borderRadius: 11,
    padding: 11,
    alignItems: "center",
  },
  apiButtonText: { color: "#fff", fontWeight: "900", fontSize: 11 },
  openButton: {
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  openButtonText: { fontWeight: "800", color: "#333", fontSize: 11 },
  confirmButton: {
    backgroundColor: "#edf5eb",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    marginTop: 7,
  },
  confirmButtonText: { fontWeight: "900", color: "#2f6333", fontSize: 11 },
  success: {
    marginTop: 13,
    backgroundColor: "#eaf4e8",
    borderRadius: 13,
    padding: 12,
  },
  successTitle: { color: "#2f6333", fontWeight: "900" },
  successText: { color: "#456a47", fontSize: 11, lineHeight: 16, marginTop: 3 },
  note: { color: "#888", fontSize: 10, lineHeight: 15, marginTop: 13 },
  backButton: {
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 13,
    padding: 12,
    alignItems: "center",
    marginTop: 14,
  },
  backText: { fontWeight: "800", color: "#333" },
});
