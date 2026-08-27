import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  getEbayDiagnostics,
  openExternalUrl,
} from "../services/ebayDiagnostics";
import { EbayDiagnostics } from "../types/ebay";

export function EbayDiagnosticsPanel() {
  const [data, setData] = useState<EbayDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      setData(await getEbayDiagnostics());
    } catch (error) {
      Alert.alert(
        "eBay-Diagnose",
        error instanceof Error ? error.message : "Diagnose fehlgeschlagen."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>EBAY SETUP-CHECK</Text>
      <Text style={styles.title}>Sandbox & API prüfen</Text>
      <Text style={styles.muted}>
        Prüft Developer Keys, OAuth, Inventory API, Kategoriebaum,
        Geschäftsrichtlinien und Verkäuferstandorte – ohne etwas zu veröffentlichen.
      </Text>

      <Pressable
        style={[styles.primary, busy && styles.disabled]}
        disabled={busy}
        onPress={run}
      >
        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator />
            <Text style={styles.primaryText}>eBay wird geprüft …</Text>
          </View>
        ) : (
          <Text style={styles.primaryText}>eBay-Sandbox prüfen</Text>
        )}
      </Pressable>

      {data && (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>
              {data.readyForPublish
                ? "Technisch veröffentlichungsbereit ✓"
                : data.readyForPreflight
                  ? "Preflight möglich – Publish noch unvollständig"
                  : "Setup noch unvollständig"}
            </Text>
            <Text style={styles.summaryText}>
              {data.environment === "sandbox" ? "Sandbox" : "Produktion"} ·{" "}
              {data.marketplaceId}
            </Text>
          </View>

          {data.checks.map((check) => (
            <View key={check.id} style={styles.checkRow}>
              <Text style={styles.icon}>
                {check.status === "ok"
                  ? "✓"
                  : check.status === "warning"
                    ? "!"
                    : check.status === "error"
                      ? "×"
                      : "…"}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkLabel}>{check.label}</Text>
                <Text style={styles.checkDetail}>{check.detail}</Text>
              </View>
            </View>
          ))}

          {data.callbackUrl && (
            <View style={styles.callbackBox}>
              <Text style={styles.callbackTitle}>eBay Accept URL</Text>
              <Text selectable style={styles.callbackUrl}>
                {data.callbackUrl}
              </Text>
              <Text style={styles.callbackHelp}>
                Diese URL muss im eBay Developer Portal dem verwendeten RuName
                als Accept URL zugeordnet sein.
              </Text>
            </View>
          )}

          <View style={styles.linksRow}>
            <Pressable
              style={styles.secondary}
              onPress={() =>
                openExternalUrl(data.sandboxHelpUrl).catch((error) =>
                  Alert.alert("Link", error.message)
                )
              }
            >
              <Text style={styles.secondaryText}>eBay Sandbox-Hilfe</Text>
            </Pressable>

            <Pressable
              style={styles.secondary}
              onPress={() =>
                openExternalUrl(data.statusUrl).catch((error) =>
                  Alert.alert("Link", error.message)
                )
              }
            >
              <Text style={styles.secondaryText}>Sandbox-Status</Text>
            </Pressable>
          </View>

          {data.environment === "sandbox" && (
            <Text style={styles.note}>
              Hinweis: Wenn Keys oder Business Policies trotz korrekter Konfiguration
              scheitern, zuerst den offiziellen Sandbox-Status prüfen. eBay kann
              dort unabhängig von unserer App Störungen haben.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8d8d8",
    borderRadius: 18,
    padding: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#666",
  },
  title: {
    fontSize: 19,
    fontWeight: "900",
    color: "#171717",
    marginTop: 4,
  },
  muted: {
    color: "#555",
    lineHeight: 20,
    marginTop: 6,
  },
  primary: {
    marginTop: 14,
    backgroundColor: "#171717",
    borderRadius: 13,
    padding: 13,
    alignItems: "center",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.45,
  },
  busyRow: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
  },
  summary: {
    marginTop: 14,
    backgroundColor: "#f3f3f1",
    borderRadius: 12,
    padding: 12,
  },
  summaryTitle: {
    fontWeight: "900",
    color: "#222",
  },
  summaryText: {
    marginTop: 4,
    color: "#666",
  },
  checkRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    alignItems: "flex-start",
  },
  icon: {
    width: 22,
    fontSize: 17,
    fontWeight: "900",
    color: "#222",
  },
  checkLabel: {
    fontWeight: "800",
    color: "#333",
  },
  checkDetail: {
    color: "#666",
    lineHeight: 18,
    marginTop: 2,
    fontSize: 12,
  },
  callbackBox: {
    marginTop: 14,
    backgroundColor: "#f5f5f3",
    borderRadius: 12,
    padding: 11,
  },
  callbackTitle: {
    fontWeight: "800",
    color: "#333",
  },
  callbackUrl: {
    fontFamily: undefined,
    color: "#222",
    marginTop: 6,
    fontSize: 12,
  },
  callbackHelp: {
    color: "#6a6a6a",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  linksRow: {
    marginTop: 12,
  },
  secondary: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 12,
    padding: 11,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryText: {
    color: "#333",
    fontWeight: "800",
  },
  note: {
    color: "#76501f",
    backgroundColor: "#fff6e8",
    padding: 10,
    borderRadius: 10,
    lineHeight: 17,
    fontSize: 11,
    marginTop: 12,
  },
});
