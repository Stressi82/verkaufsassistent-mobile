import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  loadEbayCategoryDetails,
  prepareEbayListing,
  publishEbayListing,
  uploadEbayImages,
} from "../services/ebayPublish";
import { getEbayStatus } from "../services/ebay";
import {
  EbayAspect,
  EbayPreflight,
  EbayPublishConfig,
  EbayPublishResult,
} from "../types/ebay";
import { ListingDraft, PhotoItem } from "../types/listing";
import { PlatformCopy } from "../types/platformCopy";
import { SellerProfile } from "../types/seller";

type Props = {
  draft: ListingDraft;
  sellerProfile: SellerProfile;
  photos: PhotoItem[];
  platformCopy?: PlatformCopy;
  privacyBlocked?: boolean;
  onPublished?: (result: EbayPublishResult) => void;
};

function configFromPreflight(data: EbayPreflight): EbayPublishConfig {
  const aspects: Record<string, string[]> = {};
  data.aspects.forEach((aspect) => {
    if (aspect.prefilledValue) aspects[aspect.name] = [aspect.prefilledValue];
  });

  return {
    categoryId: data.selectedCategoryId,
    sku: data.defaults.sku,
    merchantLocationKey: data.defaults.merchantLocationKey,
    paymentPolicyId: data.defaults.paymentPolicyId,
    fulfillmentPolicyId: data.defaults.fulfillmentPolicyId,
    returnPolicyId: data.defaults.returnPolicyId,
    condition: data.defaults.condition,
    quantity: 1,
    aspects,
  };
}

export function EbayPublishPanel({
  draft,
  sellerProfile,
  photos,
  platformCopy,
  privacyBlocked = false,
  onPublished,
}: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [preflight, setPreflight] = useState<EbayPreflight | null>(null);
  const [config, setConfig] = useState<EbayPublishConfig | null>(null);
  const [aspects, setAspects] = useState<EbayAspect[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [result, setResult] = useState<EbayPublishResult | null>(null);

  useEffect(() => {
    getEbayStatus().then((status) => setConnected(status.connected));
  }, []);

  const requiredMissing = useMemo(() => {
    if (!config) return [] as string[];
    const missing = aspects
      .filter((aspect) => aspect.required)
      .filter((aspect) => !(config.aspects[aspect.name]?.[0] || "").trim())
      .map((aspect) => aspect.name);

    if (!config.categoryId) missing.push("Kategorie");
    if (!config.condition) missing.push("Zustand");
    if (!config.fulfillmentPolicyId) missing.push("Versandrichtlinie");
    if (!config.paymentPolicyId) missing.push("Zahlungsrichtlinie");
    if (!config.returnPolicyId) missing.push("Rückgaberichtlinie");
    if (Object.values(config.aspects).every((values) => !(values?.[0] || "").trim())) {
      missing.push("mindestens ein Artikelmerkmal");
    }
    if (privacyBlocked) {
      missing.push("Foto-Privatsphäre prüfen");
    }
    return Array.from(new Set(missing));
  }, [aspects, config, privacyBlocked]);

  const prepare = async (categoryId?: string) => {
    setBusy(true);
    setStage("eBay-Daten werden geladen …");
    try {
      const data = await prepareEbayListing(draft, sellerProfile, categoryId);
      setConnected(data.connected);
      setPreflight(data);
      setAspects(data.aspects);
      setConfig(configFromPreflight(data));
      setResult(null);
    } catch (error) {
      Alert.alert(
        "eBay vorbereiten",
        error instanceof Error ? error.message : "Vorbereitung fehlgeschlagen."
      );
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const selectCategory = async (categoryId: string) => {
    if (!config) return;
    setBusy(true);
    setStage("Kategorieanforderungen werden geladen …");
    try {
      const details = await loadEbayCategoryDetails(categoryId, draft);
      const nextAspects: Record<string, string[]> = {};
      details.aspects.forEach((aspect) => {
        if (aspect.prefilledValue) nextAspects[aspect.name] = [aspect.prefilledValue];
      });
      setAspects(details.aspects);
      setConfig({
        ...config,
        categoryId,
        condition: details.conditions[0]?.conditionEnum || config.condition,
        aspects: nextAspects,
      });
      setPreflight((current) =>
        current ? { ...current, selectedCategoryId: categoryId, conditions: details.conditions } : current
      );
    } catch (error) {
      Alert.alert(
        "eBay-Kategorie",
        error instanceof Error ? error.message : "Kategorie konnte nicht geladen werden."
      );
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const setAspect = (name: string, value: string) => {
    if (!config) return;
    setConfig({
      ...config,
      aspects: { ...config.aspects, [name]: value.trim() ? [value] : [] },
    });
  };

  const publish = async () => {
    if (!config || !preflight) return;
    if (requiredMissing.length > 0) {
      Alert.alert(
        "Pflichtangaben fehlen",
        `Bitte ergänze: ${requiredMissing.join(", ")}`
      );
      return;
    }

    setBusy(true);
    setResult(null);
    try {
      setStage(`1/4 · ${photos.length} Foto${photos.length === 1 ? "" : "s"} zu eBay laden …`);
      const imageUrls = await uploadEbayImages(photos);
      if (imageUrls.length === 0) throw new Error("eBay hat keine Bild-URL zurückgegeben.");

      setStage("2/4 · Inventory Item anlegen …");
      // Backend performs location + inventory item + offer + publish as one guarded transaction-like flow.
      const published = await publishEbayListing({
        draft,
        platformCopy,
        sellerProfile,
        config,
        imageUrls,
      });
      setStage("4/4 · Veröffentlicht ✓");
      setResult(published);
      onPublished?.(published);
      Alert.alert("eBay", `Anzeige veröffentlicht. Listing-ID: ${published.listingId}`);
    } catch (error) {
      Alert.alert(
        "eBay-Veröffentlichung",
        error instanceof Error ? error.message : "Veröffentlichung fehlgeschlagen."
      );
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  if (connected === null) {
    return (
      <View style={styles.card}>
        <ActivityIndicator />
        <Text style={styles.muted}>eBay-Verbindung wird geprüft …</Text>
      </View>
    );
  }

  if (!connected) {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>EBAY DIREKT-POSTING</Text>
        <Text style={styles.title}>eBay noch nicht verbunden</Text>
        <Text style={styles.muted}>
          Verbinde das eBay-Konto im vorherigen Schritt „Versand, Abholung & Zahlung“.
        </Text>
      </View>
    );
  }

  if (!preflight || !config) {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>EBAY DIREKT-POSTING</Text>
        <Text style={styles.title}>Veröffentlichung vorbereiten</Text>
        <Text style={styles.muted}>
          eBay schlägt Kategorie und zulässige Zustände vor. Deine vorhandenen
          Zahlungs-, Versand- und Rückgaberichtlinien werden geladen.
        </Text>
        <Pressable style={styles.primary} onPress={() => prepare()} disabled={busy}>
          <Text style={styles.primaryText}>
            {busy ? stage || "Wird vorbereitet …" : "eBay vorbereiten"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>EBAY DIREKT-POSTING</Text>
      <Text style={styles.title}>Bereit für die eBay-API</Text>
      <Text style={styles.muted}>
        SKU {config.sku} · Standort {config.merchantLocationKey} · Menge {config.quantity}
      </Text>

      {preflight.warnings.length > 0 && (
        <View style={styles.warningBox}>
          {preflight.warnings.map((warning, index) => (
            <Text key={`${warning}-${index}`} style={styles.warningText}>• {warning}</Text>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Kategorie</Text>
      {preflight.categories.map((category) => {
        const active = config.categoryId === category.categoryId;
        return (
          <Pressable
            key={category.categoryId}
            onPress={() => selectCategory(category.categoryId)}
            style={[styles.choice, active && styles.choiceActive]}
          >
            <Text style={[styles.choiceTitle, active && styles.choiceTitleActive]}>
              {active ? "✓ " : ""}{category.categoryName}
            </Text>
            <Text style={[styles.choiceMeta, active && styles.choiceMetaActive]}>
              {category.breadcrumb}
            </Text>
          </Pressable>
        );
      })}

      <Text style={styles.sectionTitle}>Zustand</Text>
      <View style={styles.wrap}>
        {preflight.conditions.map((condition) => {
          const active = config.condition === condition.conditionEnum;
          return (
            <Pressable
              key={condition.conditionEnum}
              onPress={() => setConfig({ ...config, condition: condition.conditionEnum })}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {condition.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {preflight.conditions.find((condition) => condition.conditionEnum === config.condition)?.helpText ? (
        <Text style={styles.conditionHelp}>
          {preflight.conditions.find((condition) => condition.conditionEnum === config.condition)?.helpText}
        </Text>
      ) : null}

      <PolicyChooser
        label="Versandrichtlinie"
        policies={preflight.fulfillmentPolicies}
        selectedId={config.fulfillmentPolicyId}
        onSelect={(fulfillmentPolicyId) => setConfig({ ...config, fulfillmentPolicyId })}
      />
      <PolicyChooser
        label="Zahlungsrichtlinie"
        policies={preflight.paymentPolicies}
        selectedId={config.paymentPolicyId}
        onSelect={(paymentPolicyId) => setConfig({ ...config, paymentPolicyId })}
      />
      <PolicyChooser
        label="Rückgaberichtlinie"
        policies={preflight.returnPolicies}
        selectedId={config.returnPolicyId}
        onSelect={(returnPolicyId) => setConfig({ ...config, returnPolicyId })}
      />

      {aspects.length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>Artikelmerkmale</Text>
          <Text style={styles.mutedSmall}>
            Mit * markierte Merkmale sind für die gewählte eBay-Kategorie erforderlich.
          </Text>
          {aspects.filter((aspect, index) =>
            aspect.required || aspect.prefilledValue || index < 4
          ).map((aspect) => (
            <View key={aspect.name} style={styles.field}>
              <Text style={styles.label}>{aspect.name}{aspect.required ? " *" : ""}</Text>
              <TextInput
                value={config.aspects[aspect.name]?.[0] || ""}
                onChangeText={(value) => setAspect(aspect.name, value)}
                style={styles.input}
                placeholder={aspect.values[0] || "Wert eingeben"}
              />
              {aspect.values.length > 0 && (
                <View style={styles.wrap}>
                  {aspect.values.slice(0, 6).map((value) => (
                    <Pressable key={value} style={styles.miniChip} onPress={() => setAspect(aspect.name, value)}>
                      <Text style={styles.miniChipText}>{value}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {requiredMissing.length > 0 && (
        <Text style={styles.missing}>
          Noch erforderlich: {requiredMissing.join(" · ")}
        </Text>
      )}

      <Pressable
        style={[styles.publish, (busy || requiredMissing.length > 0) && styles.disabled]}
        disabled={busy || requiredMissing.length > 0}
        onPress={publish}
      >
        <Text style={styles.publishText}>
          {busy ? stage || "eBay verarbeitet …" : "Jetzt bei eBay veröffentlichen"}
        </Text>
      </Pressable>

      <Text style={styles.safety}>
        Dieser Button veröffentlicht wirklich über die eBay Inventory API, sobald
        das Backend mit einem eBay-Konto verbunden ist. Vorher werden Bilder zu
        eBay Picture Services hochgeladen und Pflichtfelder geprüft.
      </Text>

      {result && (
        <View style={styles.success}>
          <Text style={styles.successTitle}>Veröffentlicht ✓</Text>
          <Text style={styles.successText}>Listing-ID: {result.listingId}</Text>
          <Pressable
            style={styles.secondary}
            onPress={() => Linking.openURL(result.listingUrl)}
          >
            <Text style={styles.secondaryText}>eBay-Angebot öffnen</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function PolicyChooser({
  label,
  policies,
  selectedId,
  onSelect,
}: {
  label: string;
  policies: { id: string; name: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{label}</Text>
      {policies.length === 0 ? (
        <Text style={styles.missing}>Keine passende eBay-Richtlinie gefunden.</Text>
      ) : (
        <View style={styles.wrap}>
          {policies.map((policy) => {
            const active = selectedId === policy.id;
            return (
              <Pressable
                key={policy.id}
                onPress={() => onSelect(policy.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {active ? "✓ " : ""}{policy.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#171717",
    borderRadius: 18,
    padding: 16,
  },
  eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2, color: "#666" },
  title: { fontSize: 21, fontWeight: "900", color: "#171717", marginTop: 4 },
  muted: { color: "#5b5b5b", lineHeight: 20, marginTop: 7 },
  mutedSmall: { color: "#707070", fontSize: 12, lineHeight: 18, marginTop: 4 },
  conditionHelp: { color: "#5b5b5b", fontSize: 12, lineHeight: 18, marginTop: 8, backgroundColor: "#f5f5f3", padding: 9, borderRadius: 9 },
  primary: { backgroundColor: "#171717", borderRadius: 14, padding: 14, marginTop: 16, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "800" },
  sectionTitle: { fontSize: 15, fontWeight: "900", color: "#222", marginTop: 18, marginBottom: 7 },
  choice: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 11, marginTop: 7 },
  choiceActive: { backgroundColor: "#171717", borderColor: "#171717" },
  choiceTitle: { color: "#222", fontWeight: "800" },
  choiceTitleActive: { color: "#fff" },
  choiceMeta: { color: "#777", fontSize: 12, marginTop: 3 },
  choiceMetaActive: { color: "#d8d8d8" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { borderWidth: 1, borderColor: "#ccc", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8, marginTop: 5 },
  chipActive: { backgroundColor: "#171717", borderColor: "#171717" },
  chipText: { color: "#333", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#fff" },
  field: { marginTop: 12 },
  label: { fontWeight: "800", fontSize: 12, color: "#444", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#d8d8d8", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  miniChip: { backgroundColor: "#f1f1ef", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, marginTop: 6 },
  miniChipText: { fontSize: 11, color: "#444" },
  missing: { color: "#8a301d", fontWeight: "700", lineHeight: 19, marginTop: 12 },
  publish: { backgroundColor: "#171717", borderRadius: 15, padding: 16, alignItems: "center", marginTop: 20 },
  publishText: { color: "#fff", fontWeight: "900", fontSize: 15, textAlign: "center" },
  disabled: { opacity: 0.35 },
  safety: { color: "#777", fontSize: 11, lineHeight: 17, marginTop: 10 },
  warningBox: { backgroundColor: "#fff4e9", borderRadius: 11, padding: 10, marginTop: 12 },
  warningText: { color: "#7a471e", lineHeight: 18, fontSize: 12 },
  success: { backgroundColor: "#eef6ef", borderRadius: 13, padding: 13, marginTop: 16 },
  successTitle: { fontWeight: "900", fontSize: 17, color: "#285c30" },
  successText: { color: "#3c6542", marginTop: 4 },
  secondary: { borderWidth: 1, borderColor: "#b9c9bb", borderRadius: 12, padding: 11, marginTop: 10, alignItems: "center" },
  secondaryText: { color: "#285c30", fontWeight: "800" },
});
