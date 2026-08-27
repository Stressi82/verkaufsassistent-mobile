import React, { useMemo } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { calculateShipping } from "../services/shippingCatalog";
import {
  ShippingDestinationMode,
  ShippingPackageInput,
  ShippingPriority,
  ShippingQuote,
} from "../types/shipping";

type Props = {
  value: ShippingPackageInput;
  itemValue: number;
  selectedId?: string | null;
  onChange: (next: ShippingPackageInput) => void;
  onApply: (quote: ShippingQuote) => void;
};

const PRIORITY_LABELS: Record<ShippingPriority, string> = {
  cheapest: "Günstig",
  tracking: "Mit Tracking",
  insured: "Absicherung",
};

const DESTINATION_LABELS: Record<ShippingDestinationMode, string> = {
  door: "Haustür",
  shop: "PaketShop/Station",
  either: "Egal",
};

function money(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} €`;
}

export function ShippingAssistant({
  value,
  itemValue,
  selectedId,
  onChange,
  onApply,
}: Props) {
  const result = useMemo(
    () => calculateShipping(value, itemValue),
    [value, itemValue]
  );

  const update = (patch: Partial<ShippingPackageInput>) =>
    onChange({ ...value, ...patch });

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>VERSANDASSISTENT</Text>
      <Text style={styles.title}>Welches Paket passt?</Text>
      <Text style={styles.muted}>
        Maße und Gewicht des fertig verpackten Pakets eingeben. Die App
        vergleicht hinterlegte Privatkundentarife für DHL, Hermes und DPD.
      </Text>

      <View style={styles.twoCols}>
        <Field
          label="Gewicht kg"
          value={value.weightKg}
          placeholder="2,4"
          onChange={(weightKg) => update({ weightKg })}
        />
        <View style={{ width: 10 }} />
        <Field
          label="Länge cm"
          value={value.lengthCm}
          placeholder="45"
          onChange={(lengthCm) => update({ lengthCm })}
        />
      </View>

      <View style={styles.twoCols}>
        <Field
          label="Breite cm"
          value={value.widthCm}
          placeholder="30"
          onChange={(widthCm) => update({ widthCm })}
        />
        <View style={{ width: 10 }} />
        <Field
          label="Höhe cm"
          value={value.heightCm}
          placeholder="18"
          onChange={(heightCm) => update({ heightCm })}
        />
      </View>

      <Text style={styles.label}>Priorität</Text>
      <View style={styles.chips}>
        {(Object.keys(PRIORITY_LABELS) as ShippingPriority[]).map((priority) => (
          <Chip
            key={priority}
            active={value.priority === priority}
            label={PRIORITY_LABELS[priority]}
            onPress={() => update({ priority })}
          />
        ))}
      </View>

      <Text style={styles.label}>Zustellung</Text>
      <View style={styles.chips}>
        {(Object.keys(DESTINATION_LABELS) as ShippingDestinationMode[]).map(
          (destinationMode) => (
            <Chip
              key={destinationMode}
              active={value.destinationMode === destinationMode}
              label={DESTINATION_LABELS[destinationMode]}
              onPress={() => update({ destinationMode })}
            />
          )
        )}
      </View>

      {!result.inputValid && (
        <View style={styles.info}>
          {result.validationMessages.map((message) => (
            <Text key={message} style={styles.infoText}>• {message}</Text>
          ))}
        </View>
      )}

      {result.warnings.map((warning) => (
        <View key={warning} style={styles.warningBox}>
          <Text style={styles.warningText}>⚠ {warning}</Text>
        </View>
      ))}

      {result.inputValid && result.matches.length > 0 && (
        <>
          <View style={styles.headingRow}>
            <Text style={styles.resultTitle}>Passende Tarife</Text>
            <Text style={styles.resultCount}>
              {result.matches.length} gefunden
            </Text>
          </View>

          {result.matches.slice(0, 8).map((quote, index) => {
            const recommended = quote.id === result.recommendedId;
            const selected = quote.id === selectedId;

            return (
              <View
                key={quote.id}
                style={[
                  styles.quote,
                  recommended && styles.quoteRecommended,
                  selected && styles.quoteSelected,
                ]}
              >
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.badgeRow}>
                      {recommended && (
                        <Text style={styles.recommended}>EMPFOHLEN</Text>
                      )}
                      {selected && (
                        <Text style={styles.selected}>ÜBERNOMMEN</Text>
                      )}
                    </View>
                    <Text style={styles.carrier}>{quote.carrier}</Text>
                    <Text style={styles.product}>{quote.product}</Text>
                  </View>
                  <Text style={styles.price}>{money(quote.price)}</Text>
                </View>

                <View style={styles.features}>
                  <Text style={styles.feature}>
                    {quote.tracking ? "✓ Tracking" : "○ kein Tracking"}
                  </Text>
                  <Text style={styles.feature}>
                    Haftung {quote.liabilityEur > 0 ? `bis ${quote.liabilityEur} €` : "keine"}
                  </Text>
                  {quote.estimatedDays && (
                    <Text style={styles.feature}>{quote.estimatedDays}</Text>
                  )}
                </View>

                <Text style={styles.fit}>{quote.fitReason}</Text>

                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.apply}
                    onPress={() => onApply(quote)}
                  >
                    <Text style={styles.applyText}>
                      {selected ? "Erneut übernehmen" : "Versand übernehmen"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.open}
                    onPress={() => Linking.openURL(quote.purchaseUrl)}
                  >
                    <Text style={styles.openText}>Anbieter öffnen</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </>
      )}

      <Text style={styles.sourceNote}>
        Preisstand in der App geprüft am 26.08.2026. Vor dem Kauf der
        Versandmarke zeigt die Anbieterseite den verbindlichen aktuellen Preis.
      </Text>
    </View>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType="decimal-pad"
        style={styles.input}
      />
    </View>
  );
}

function Chip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#171717",
    borderRadius: 18,
    padding: 15,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#666",
  },
  title: { fontSize: 20, fontWeight: "900", marginTop: 4, color: "#171717" },
  muted: { color: "#666", lineHeight: 19, marginTop: 5 },
  twoCols: { flexDirection: "row" },
  label: {
    fontSize: 11,
    fontWeight: "900",
    color: "#444",
    marginTop: 12,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d4d4d4",
    borderRadius: 11,
    padding: 11,
    backgroundColor: "#fff",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: "#171717",
    borderColor: "#171717",
  },
  chipText: { fontSize: 11, fontWeight: "800", color: "#333" },
  chipTextActive: { color: "#fff" },
  info: {
    marginTop: 12,
    backgroundColor: "#f5f5f2",
    borderRadius: 11,
    padding: 10,
  },
  infoText: { color: "#666", fontSize: 11, lineHeight: 16 },
  warningBox: {
    marginTop: 10,
    backgroundColor: "#fff1ed",
    borderRadius: 11,
    padding: 10,
  },
  warningText: { color: "#843226", fontSize: 11, lineHeight: 16 },
  headingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  resultTitle: { fontSize: 16, fontWeight: "900" },
  resultCount: { fontSize: 10, fontWeight: "800", color: "#777" },
  quote: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 14,
    padding: 12,
    marginTop: 9,
  },
  quoteRecommended: { borderColor: "#171717", borderWidth: 2 },
  quoteSelected: { backgroundColor: "#f2f6f1" },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  badgeRow: { flexDirection: "row", gap: 5, marginBottom: 4 },
  recommended: {
    fontSize: 9,
    fontWeight: "900",
    backgroundColor: "#171717",
    color: "#fff",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  selected: {
    fontSize: 9,
    fontWeight: "900",
    backgroundColor: "#e4efe2",
    color: "#2d6333",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  carrier: { fontWeight: "900", color: "#222" },
  product: { color: "#666", fontSize: 12, marginTop: 2 },
  price: { fontSize: 22, fontWeight: "900" },
  features: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 9 },
  feature: { fontSize: 10, fontWeight: "800", color: "#555" },
  fit: { color: "#777", fontSize: 10, marginTop: 6 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  apply: {
    flex: 1,
    backgroundColor: "#171717",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  applyText: { color: "#fff", fontWeight: "900", fontSize: 11 },
  open: {
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  openText: { color: "#333", fontWeight: "800", fontSize: 11 },
  sourceNote: {
    color: "#888",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 12,
  },
});
