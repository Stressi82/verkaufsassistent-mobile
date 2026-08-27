import React from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { PlatformCopy } from "../types/platformCopy";
import { SalesPlatform } from "../types/platform";
import { sharePlatformCopy } from "../services/platformCopy";

type Props = {
  copy: PlatformCopy;
  platform: SalesPlatform;
  onChange: (copy: PlatformCopy) => void;
};

export function PlatformCopyCard({ copy, platform, onChange }: Props) {
  const titleCount = copy.title.length;
  const overLimit = Boolean(copy.titleLimit && titleCount > copy.titleLimit);

  const openPlatform = async () => {
    const supported = await Linking.canOpenURL(platform.sellUrl);
    if (supported) await Linking.openURL(platform.sellUrl);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{platform.name}</Text>
          <Text style={styles.source}>
            {copy.generatedBy === "ai" ? "KI-Version" : "Lokale Fallback-Version"}
          </Text>
        </View>
        {copy.titleLimit && (
          <Text style={[styles.counter, overLimit && styles.counterWarning]}>
            {titleCount}/{copy.titleLimit}
          </Text>
        )}
      </View>

      <Text style={styles.label}>Plattform-Titel</Text>
      <TextInput
        value={copy.title}
        onChangeText={(title) => onChange({ ...copy, title })}
        style={[styles.input, overLimit && styles.inputWarning]}
        multiline
      />

      <Text style={styles.label}>Preis</Text>
      <TextInput
        value={copy.priceText}
        onChangeText={(priceText) => onChange({ ...copy, priceText })}
        style={styles.input}
      />

      <View style={styles.descriptionHeader}>
        <Text style={styles.label}>Plattform-Beschreibung</Text>
        <Text style={styles.descriptionCount}>{copy.description.length} Zeichen</Text>
      </View>
      <TextInput
        value={copy.description}
        onChangeText={(description) => onChange({ ...copy, description })}
        style={[styles.input, styles.multiline]}
        multiline
      />

      {copy.tips.length > 0 && (
        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>Für {platform.name}</Text>
          {copy.tips.slice(0, 3).map((tip, index) => (
            <Text key={`${tip}-${index}`} style={styles.tipText}>
              • {tip}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={styles.primarySmall} onPress={() => sharePlatformCopy(copy)}>
          <Text style={styles.primaryText}>Diese Version teilen</Text>
        </Pressable>
        <Pressable style={styles.secondarySmall} onPress={openPlatform}>
          <Text style={styles.secondaryText}>{platform.name} öffnen</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8d8d8",
    borderRadius: 18,
    padding: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: { fontSize: 20, fontWeight: "800", color: "#171717" },
  source: { color: "#777", fontSize: 12, marginTop: 3 },
  counter: {
    fontSize: 12,
    fontWeight: "800",
    backgroundColor: "#efefed",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 99,
  },
  counterWarning: { color: "#9f1d1d", backgroundColor: "#f8e7e4" },
  label: { fontSize: 12, fontWeight: "800", color: "#444", marginTop: 15, marginBottom: 6 },
  input: {
    backgroundColor: "#f7f7f5",
    borderWidth: 1,
    borderColor: "#dedede",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: "#171717",
    fontSize: 15,
  },
  inputWarning: { borderColor: "#b74732" },
  multiline: { minHeight: 150, textAlignVertical: "top" },
  descriptionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  descriptionCount: { color: "#888", fontSize: 11 },
  tipBox: { backgroundColor: "#f2f2f0", borderRadius: 12, padding: 11, marginTop: 12 },
  tipTitle: { fontWeight: "800", color: "#333", marginBottom: 3 },
  tipText: { color: "#555", lineHeight: 18, fontSize: 12, marginTop: 2 },
  actions: { marginTop: 14 },
  primarySmall: {
    backgroundColor: "#171717",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "800" },
  secondarySmall: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryText: { color: "#222", fontWeight: "700" },
});
