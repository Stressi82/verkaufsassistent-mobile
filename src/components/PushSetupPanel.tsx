import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getEbayNotificationStatus,
  getPushRegistrationStatus,
  registerPushNotifications,
  sendTestPush,
  setupEbayMessageNotifications,
  testEbayMessageSubscription,
} from "../services/pushNotifications";
import {
  EbayNotificationStatus,
  PushRegistrationStatus,
} from "../types/push";
import {
  loadPushPairingCode,
  savePushPairingCode,
} from "../services/pushPairing";

export function PushSetupPanel() {
  const [push, setPush] =
    useState<PushRegistrationStatus | null>(null);
  const [ebay, setEbay] =
    useState<EbayNotificationStatus | null>(null);
  const [busy, setBusy] = useState<
    "push" | "push-test" | "ebay" | "ebay-test" | null
  >(null);
  const [pairingCode, setPairingCode] = useState("");
  const [pairingLoaded, setPairingLoaded] = useState(false);

  const refresh = async () => {
    const [pushStatus, ebayStatus] =
      await Promise.allSettled([
        getPushRegistrationStatus(pairingCode),
        getEbayNotificationStatus(pairingCode),
      ]);

    if (pushStatus.status === "fulfilled") {
      setPush(pushStatus.value);
    }
    if (ebayStatus.status === "fulfilled") {
      setEbay(ebayStatus.value);
    }
  };

  useEffect(() => {
    loadPushPairingCode()
      .then((code) => {
        setPairingCode(code);
        setPairingLoaded(true);
      })
      .catch(() => setPairingLoaded(true));
  }, []);

  useEffect(() => {
    if (pairingLoaded) {
      refresh();
    }
  }, [pairingLoaded]);

  const persistPairing = async () => {
    const trimmed = pairingCode.trim();
    if (trimmed.length < 8) {
      Alert.alert(
        "Pairing-Code",
        "Der Backend-Pairing-Code muss mindestens 8 Zeichen lang sein."
      );
      return;
    }

    await savePushPairingCode(trimmed);
    setPairingCode(trimmed);
    await refresh();
    Alert.alert(
      "Pairing gespeichert",
      "Die App kann jetzt geschützte Push- und Webhook-Einstellungen am Backend aufrufen."
    );
  };

  const activatePush = async () => {
    setBusy("push");
    try {
      const token = await registerPushNotifications(pairingCode);
      await refresh();
      Alert.alert(
        "Push aktiviert",
        `Dieses Gerät ist registriert (${token.slice(0, 22)}…).`
      );
    } catch (error) {
      Alert.alert(
        "Push aktivieren",
        error instanceof Error
          ? error.message
          : "Push konnte nicht aktiviert werden."
      );
    } finally {
      setBusy(null);
    }
  };

  const testPush = async () => {
    setBusy("push-test");
    try {
      await sendTestPush(pairingCode);
      Alert.alert(
        "Test gesendet",
        "Der Test-Push wurde an die registrierten Geräte übergeben."
      );
    } catch (error) {
      Alert.alert(
        "Test-Push",
        error instanceof Error
          ? error.message
          : "Test-Push fehlgeschlagen."
      );
    } finally {
      setBusy(null);
    }
  };

  const setupEbay = async () => {
    setBusy("ebay");
    try {
      const next = await setupEbayMessageNotifications(pairingCode);
      setEbay(next);
      Alert.alert(
        "eBay Webhook",
        next.enabled
          ? "NEW_MESSAGE ist aktiv."
          : "Webhook wurde eingerichtet. Prüfe den Status erneut."
      );
    } catch (error) {
      Alert.alert(
        "eBay Webhook",
        error instanceof Error
          ? error.message
          : "Webhook konnte nicht eingerichtet werden."
      );
    } finally {
      setBusy(null);
    }
  };

  const testEbay = async () => {
    setBusy("ebay-test");
    try {
      await testEbayMessageSubscription(pairingCode);
      Alert.alert(
        "eBay-Test ausgelöst",
        "eBay hat den Subscription-Test angenommen. Ein Testevent kann anschließend am Webhook eintreffen."
      );
      setTimeout(() => {
        refresh().catch(() => undefined);
      }, 1500);
    } catch (error) {
      Alert.alert(
        "eBay-Test",
        error instanceof Error
          ? error.message
          : "eBay-Test konnte nicht gestartet werden."
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>PUSH & WEBHOOK</Text>
      <Text style={styles.title}>Neue Anfrage sofort melden</Text>
      <Text style={styles.muted}>
        eBay sendet NEW_MESSAGE an das Backend. Das Backend prüft die
        eBay-Signatur und schickt danach einen Push auf dein Handy.
      </Text>

      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Handy-Push</Text>
          <Status
            ok={Boolean(push?.tokenRegistered)}
            label={
              push?.tokenRegistered
                ? "GERÄT ✓"
                : push?.permission === "denied"
                  ? "blockiert"
                  : "noch aus"
            }
          />
        </View>

        <Text style={styles.detail}>
          {push?.detail || "Push-Status wird geladen …"}
        </Text>

        {!push?.projectIdConfigured && (
          <Text style={styles.warning}>
            EAS Project ID fehlt. Nach `eas init` bzw. EAS-Projektverknüpfung
            kann Expo einen Push-Token erzeugen.
          </Text>
        )}

        <Pressable
          style={[styles.primary, busy === "push" && styles.disabled]}
          disabled={busy !== null || pairingCode.trim().length < 8}
          onPress={activatePush}
        >
          <Text style={styles.primaryText}>
            {busy === "push"
              ? "Push wird aktiviert …"
              : "Push für dieses Gerät aktivieren"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.secondary}
          disabled={busy !== null || !push?.tokenRegistered}
          onPress={testPush}
        >
          <Text style={styles.secondaryText}>
            {busy === "push-test"
              ? "Test läuft …"
              : "Test-Push senden"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>eBay NEW_MESSAGE</Text>
          <Status
            ok={Boolean(ebay?.enabled)}
            label={ebay?.enabled ? "AKTIV ✓" : "noch aus"}
          />
        </View>

        <Text style={styles.detail}>
          {ebay?.detail || "eBay-Webhookstatus wird geladen …"}
        </Text>

        {ebay?.endpoint && (
          <Text selectable style={styles.endpoint}>
            {ebay.endpoint}
          </Text>
        )}

        <View style={styles.miniGrid}>
          <Mini
            label="HTTPS"
            value={ebay?.configured ? "✓" : "–"}
          />
          <Mini
            label="OAuth"
            value={ebay?.connected ? "✓" : "–"}
          />
          <Mini
            label="Destination"
            value={ebay?.destinationId ? "✓" : "–"}
          />
          <Mini
            label="Subscription"
            value={ebay?.subscriptionId ? "✓" : "–"}
          />
        </View>

        <Text style={styles.eventText}>
          Empfangene Webhook-Events in dieser Serverlaufzeit:{" "}
          {ebay?.recentEvents ?? 0}
          {ebay?.lastEventAt
            ? ` · zuletzt ${new Date(ebay.lastEventAt).toLocaleString("de-DE")}`
            : ""}
        </Text>

        <Pressable
          style={[styles.primary, busy === "ebay" && styles.disabled]}
          disabled={busy !== null || pairingCode.trim().length < 8}
          onPress={setupEbay}
        >
          <Text style={styles.primaryText}>
            {busy === "ebay"
              ? "eBay wird eingerichtet …"
              : "eBay Push-Webhook einrichten"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.secondary}
          disabled={busy !== null || !ebay?.subscriptionId}
          onPress={testEbay}
        >
          <Text style={styles.secondaryText}>
            {busy === "ebay-test"
              ? "eBay-Test läuft …"
              : "eBay Subscription testen"}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.note}>
        Der Push zeigt absichtlich nur „Neue eBay-Anfrage“. Der eigentliche
        Nachrichtentext bleibt in der geschützten Inbox der App.
      </Text>
    </View>
  );
}

function Status({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <Text
      style={[
        styles.status,
        ok ? styles.statusOk : styles.statusPending,
      ]}
    >
      {label}
    </Text>
  );
}

function Mini({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#171717",
    borderRadius: 17,
    padding: 14,
  },
  eyebrow: {
    fontSize: 10,
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
    color: "#666",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  section: {
    marginTop: 13,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
  },
  sectionTitle: {
    fontWeight: "900",
    color: "#222",
  },
  status: {
    fontSize: 9,
    fontWeight: "900",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  statusOk: {
    backgroundColor: "#eaf4e8",
    color: "#2f6333",
  },
  statusPending: {
    backgroundColor: "#eee",
    color: "#666",
  },
  detail: {
    color: "#666",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  pairingInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 10,
    marginTop: 9,
  },
  warning: {
    color: "#8a4e20",
    backgroundColor: "#fff5e9",
    borderRadius: 9,
    padding: 8,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 8,
  },
  endpoint: {
    color: "#555",
    fontSize: 9,
    marginTop: 7,
  },
  miniGrid: {
    flexDirection: "row",
    gap: 6,
    marginTop: 9,
  },
  mini: {
    flex: 1,
    backgroundColor: "#f5f5f2",
    borderRadius: 9,
    padding: 8,
    alignItems: "center",
  },
  miniValue: {
    fontWeight: "900",
    fontSize: 15,
  },
  miniLabel: {
    color: "#777",
    fontSize: 8,
    marginTop: 2,
  },
  eventText: {
    color: "#777",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 8,
  },
  primary: {
    backgroundColor: "#171717",
    borderRadius: 11,
    padding: 11,
    alignItems: "center",
    marginTop: 10,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 11,
  },
  secondary: {
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 11,
    padding: 10,
    alignItems: "center",
    marginTop: 7,
  },
  secondaryText: {
    color: "#333",
    fontWeight: "800",
    fontSize: 11,
  },
  disabled: {
    opacity: 0.45,
  },
  note: {
    color: "#888",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 11,
  },
});
