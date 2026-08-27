import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AIProviderInfo } from "../types/ai";
import { SALES_PLATFORMS } from "../services/platforms";
import {
  PAYMENT_LABELS,
  PaymentMethod,
  SHIPPING_LABELS,
} from "../types/seller";
import {
  SALES_GOAL_LABELS,
  SalesGoal,
  UserPreferences,
} from "../types/userPreferences";

type Props = {
  value: UserPreferences;
  providers: AIProviderInfo[];
  onChange: (next: UserPreferences) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function UserPreferencesScreen({
  value,
  providers,
  onChange,
  onSave,
  onCancel,
}: Props) {
  const seller = value.sellerProfile;

  const updateSeller = (patch: Partial<typeof seller>) => {
    onChange({
      ...value,
      sellerProfile: {
        ...seller,
        ...patch,
      },
    });
  };

  const togglePayment = (method: PaymentMethod) => {
    updateSeller({
      paymentMethods: seller.paymentMethods.includes(method)
        ? seller.paymentMethods.filter((entry) => entry !== method)
        : [...seller.paymentMethods, method],
    });
  };

  const togglePlatform = (platformId: typeof value.preferredPlatforms[number]) => {
    onChange({
      ...value,
      preferredPlatforms: value.preferredPlatforms.includes(platformId)
        ? value.preferredPlatforms.filter((id) => id !== platformId)
        : [...value.preferredPlatforms, platformId],
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>PERSÖNLICHE STANDARDS</Text>
      <Text style={styles.title}>Einmal einstellen</Text>
      <Text style={styles.muted}>
        Neue Artikel übernehmen diese Vorgaben automatisch. Du kannst sie bei
        jedem Verkauf weiterhin ändern.
      </Text>

      <Section title="Verkaufsziel">
        {(Object.keys(SALES_GOAL_LABELS) as SalesGoal[]).map((goal) => {
          const active = value.salesGoal === goal;
          return (
            <Choice
              key={goal}
              active={active}
              title={SALES_GOAL_LABELS[goal]}
              text={
                goal === "fast"
                  ? "Preis stärker auf kurze Verkaufsdauer ausrichten."
                  : goal === "maximize"
                    ? "Höher starten und mehr Verhandlungsspielraum lassen."
                    : "Marktüblichen Preis und Verkaufsdauer ausbalancieren."
              }
              onPress={() => onChange({ ...value, salesGoal: goal })}
            />
          );
        })}
      </Section>

      <Section title="Bevorzugte KI">
        {providers.map((provider) => (
          <Choice
            key={provider.id}
            active={value.preferredProvider === provider.id}
            title={provider.name}
            text={`${provider.model} · ${
              provider.configured ? "verbunden" : "noch nicht verbunden"
            }`}
            onPress={() =>
              onChange({ ...value, preferredProvider: provider.id })
            }
          />
        ))}
      </Section>

      <Section title="Standort">
        <View style={styles.chips}>
          {(["DE", "AT"] as const).map((country) => (
            <Chip
              key={country}
              active={seller.country === country}
              label={country === "DE" ? "Deutschland" : "Österreich"}
              onPress={() => updateSeller({ country })}
            />
          ))}
        </View>

        <View style={styles.twoCols}>
          <View style={{ flex: 1 }}>
            <Label>PLZ</Label>
            <TextInput
              value={seller.postalCode}
              onChangeText={(postalCode) => updateSeller({ postalCode })}
              placeholder="09111"
              style={styles.input}
            />
          </View>
          <View style={{ width: 10 }} />
          <View style={{ flex: 1 }}>
            <Label>Ort</Label>
            <TextInput
              value={seller.city}
              onChangeText={(city) => updateSeller({ city })}
              placeholder="Chemnitz"
              style={styles.input}
            />
          </View>
        </View>
      </Section>

      <Section title="Versandstandard">
        {(["pickup", "shipping", "both"] as const).map((mode) => (
          <Choice
            key={mode}
            active={seller.shippingMode === mode}
            title={SHIPPING_LABELS[mode]}
            text={
              mode === "pickup"
                ? "Standardmäßig nur Abholung."
                : mode === "shipping"
                  ? "Standardmäßig nur Versand."
                  : "Abholung und Versand anbieten."
            }
            onPress={() => updateSeller({ shippingMode: mode })}
          />
        ))}

        {(seller.shippingMode === "shipping" ||
          seller.shippingMode === "both") && (
          <>
            <Label>Versanddienst optional</Label>
            <TextInput
              value={seller.carrier}
              onChangeText={(carrier) => updateSeller({ carrier })}
              placeholder="z. B. DHL"
              style={styles.input}
            />

            <Label>Versandkosten</Label>
            <View style={styles.chips}>
              {([
                ["buyer_pays", "Käufer zahlt"],
                ["free", "Kostenlos"],
                ["fixed", "Fester Betrag"],
              ] as const).map(([mode, label]) => (
                <Chip
                  key={mode}
                  active={seller.shippingCostMode === mode}
                  label={label}
                  onPress={() => updateSeller({ shippingCostMode: mode })}
                />
              ))}
            </View>

            {seller.shippingCostMode === "fixed" && (
              <TextInput
                value={seller.shippingCost}
                onChangeText={(shippingCost) =>
                  updateSeller({ shippingCost })
                }
                placeholder="6,99"
                keyboardType="decimal-pad"
                style={styles.input}
              />
            )}
          </>
        )}
      </Section>

      <Section title="Zahlungsarten">
        {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => (
          <Choice
            key={method}
            active={seller.paymentMethods.includes(method)}
            title={PAYMENT_LABELS[method]}
            text="Für neue Artikel vorauswählen."
            onPress={() => togglePayment(method)}
          />
        ))}
      </Section>

      <Section title="Bevorzugte Plattformen">
        <Text style={styles.sectionHint}>
          Sie werden bei neuen Artikeln vorausgewählt. Die intelligente
          Artikelerkennung kann die Auswahl später noch anpassen.
        </Text>
        {SALES_PLATFORMS.map((platform) => (
          <Choice
            key={platform.id}
            active={value.preferredPlatforms.includes(platform.id)}
            title={platform.name}
            text={platform.note}
            onPress={() => togglePlatform(platform.id)}
          />
        ))}
      </Section>

      <Pressable style={styles.primary} onPress={onSave}>
        <Text style={styles.primaryText}>Standards speichern</Text>
      </Pressable>

      <Pressable style={styles.secondary} onPress={onCancel}>
        <Text style={styles.secondaryText}>Abbrechen</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

function Choice({
  active,
  title,
  text,
  onPress,
}: {
  active: boolean;
  title: string;
  text: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.choice, active && styles.choiceActive]}
      onPress={onPress}
    >
      <View style={styles.radio}>
        {active && <View style={styles.radioInner} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceText}>{text}</Text>
      </View>
    </Pressable>
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
  container: { padding: 20, paddingBottom: 50, backgroundColor: "#f6f6f4" },
  eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1.3, color: "#666" },
  title: { fontSize: 31, lineHeight: 36, fontWeight: "900", marginTop: 6 },
  muted: { color: "#666", lineHeight: 21, marginTop: 7 },
  section: {
    marginTop: 15,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 17,
    padding: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: "900", color: "#222" },
  sectionHint: { color: "#666", fontSize: 12, lineHeight: 17, marginTop: 5 },
  choice: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 13,
    padding: 11,
    marginTop: 9,
  },
  choiceActive: { borderColor: "#171717", backgroundColor: "#f5f5f2" },
  radio: {
    width: 21,
    height: 21,
    borderWidth: 2,
    borderColor: "#333",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#171717" },
  choiceTitle: { fontWeight: "900", color: "#222" },
  choiceText: { color: "#666", fontSize: 11, lineHeight: 16, marginTop: 3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 9 },
  chip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: "#171717", borderColor: "#171717" },
  chipText: { color: "#333", fontWeight: "800", fontSize: 12 },
  chipTextActive: { color: "#fff" },
  twoCols: { flexDirection: "row", marginTop: 9 },
  label: { fontWeight: "800", color: "#444", fontSize: 12, marginTop: 12, marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: "#d4d4d4",
    borderRadius: 11,
    padding: 11,
    backgroundColor: "#fff",
  },
  primary: {
    backgroundColor: "#171717",
    borderRadius: 14,
    padding: 15,
    alignItems: "center",
    marginTop: 16,
  },
  primaryText: { color: "#fff", fontWeight: "900" },
  secondary: {
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryText: { color: "#333", fontWeight: "800" },
});
