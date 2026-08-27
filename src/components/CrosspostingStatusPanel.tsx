import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SALES_PLATFORMS } from "../services/platforms";
import {
  PlatformListingStatus,
} from "../types/salesCenter";
import { SalesPlatformId } from "../types/platform";

type Props = {
  selectedPlatforms: SalesPlatformId[];
  statuses: Partial<Record<SalesPlatformId, PlatformListingStatus>>;
  onChange: (
    platformId: SalesPlatformId,
    status: PlatformListingStatus
  ) => void;
};

const LABELS: Record<PlatformListingStatus, string> = {
  not_selected: "Nicht gewählt",
  prepared: "Vorbereitet",
  online: "Online",
  sold: "Verkauft",
  removed: "Entfernt",
};

export function CrosspostingStatusPanel({
  selectedPlatforms,
  statuses,
  onChange,
}: Props) {
  if (!selectedPlatforms.length) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>CROSSPOSTING</Text>
      <Text style={styles.title}>Status je Plattform</Text>
      <Text style={styles.muted}>
        So bleibt sichtbar, wo der Artikel nur vorbereitet und wo er wirklich
        online ist. Automatische Plattform-APIs können diesen Status später
        selbst aktualisieren.
      </Text>

      {selectedPlatforms.map((platformId) => {
        const platform = SALES_PLATFORMS.find((entry) => entry.id === platformId);
        const active = statuses[platformId] || "prepared";

        return (
          <View key={platformId} style={styles.row}>
            <Text style={styles.name}>{platform?.name || platformId}</Text>
            <View style={styles.chips}>
              {(["prepared", "online", "sold"] as PlatformListingStatus[]).map(
                (status) => (
                  <Pressable
                    key={status}
                    style={[styles.chip, active === status && styles.chipActive]}
                    onPress={() => onChange(platformId, status)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active === status && styles.chipTextActive,
                      ]}
                    >
                      {LABELS[status]}
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 17,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 17,
    padding: 14,
  },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2, color: "#666" },
  title: { fontSize: 18, fontWeight: "900", marginTop: 4 },
  muted: { color: "#666", lineHeight: 18, fontSize: 12, marginTop: 5 },
  row: { marginTop: 12 },
  name: { fontWeight: "900", color: "#222" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 7 },
  chip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: "#171717", borderColor: "#171717" },
  chipText: { fontSize: 10, fontWeight: "800", color: "#444" },
  chipTextActive: { color: "#fff" },
});
