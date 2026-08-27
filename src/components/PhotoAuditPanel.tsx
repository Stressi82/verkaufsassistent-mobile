import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PhotoAuditResult } from "../types/photoAudit";

type Props = {
  result: PhotoAuditResult | null;
  busy: boolean;
  privacyAcknowledged: boolean;
  onRun: () => void;
  onApplyCover: () => void;
  onAcknowledgePrivacy: () => void;
};

export function PhotoAuditPanel({
  result,
  busy,
  privacyAcknowledged,
  onRun,
  onApplyCover,
  onAcknowledgePrivacy,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>FOTO-CHECK</Text>
      <Text style={styles.title}>Qualität, Privatsphäre & Titelbild</Text>
      <Text style={styles.muted}>
        Prüft Verkaufsqualität und warnt vor sichtbaren Gesichtern, Adressen,
        Kennzeichen oder persönlichen Dokumenten. Schäden werden nicht entfernt.
      </Text>

      <Pressable
        style={[styles.primary, busy && styles.disabled]}
        disabled={busy}
        onPress={onRun}
      >
        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator />
            <Text style={styles.primaryText}>Fotos werden geprüft …</Text>
          </View>
        ) : (
          <Text style={styles.primaryText}>Fotos jetzt prüfen</Text>
        )}
      </Pressable>

      {result && (
        <>
          <View style={styles.summary}>
            <View>
              <Text style={styles.score}>{result.overallQualityScore} %</Text>
              <Text style={styles.scoreLabel}>Fotoqualität</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>
                Titelbild: Foto {result.recommendedCoverIndex + 1}
              </Text>
              <Text style={styles.summaryText}>
                {result.privacyScanComplete
                  ? "Privatsphäre visuell geprüft"
                  : "Privatsphäre nicht vollständig geprüft"}
              </Text>
            </View>
          </View>

          <Pressable style={styles.secondary} onPress={onApplyCover}>
            <Text style={styles.secondaryText}>
              Empfohlenes Titelbild übernehmen
            </Text>
          </Pressable>

          {result.photos.map((photo) => (
            <View key={photo.photoIndex} style={styles.photoRow}>
              <View style={styles.photoNumber}>
                <Text style={styles.photoNumberText}>{photo.photoIndex + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.photoTitle}>
                    Qualität {photo.qualityScore} % · Titelbild {photo.coverScore} %
                  </Text>
                  <Text style={photo.usable ? styles.ok : styles.warning}>
                    {photo.usable ? "nutzbar" : "neu aufnehmen"}
                  </Text>
                </View>

                {photo.notes.slice(0, 3).map((note, index) => (
                  <Text key={index} style={styles.detail}>• {note}</Text>
                ))}

                {photo.privacyRisks.map((risk, index) => (
                  <Text key={`risk-${index}`} style={styles.risk}>⚠ {risk}</Text>
                ))}
              </View>
            </View>
          ))}

          {result.improvementTips.length > 0 && (
            <View style={styles.tipBox}>
              <Text style={styles.tipTitle}>Verbesserung</Text>
              {result.improvementTips.map((tip, index) => (
                <Text key={index} style={styles.detail}>• {tip}</Text>
              ))}
            </View>
          )}

          {(!result.privacyScanComplete || result.hasBlockingPrivacyRisk) && (
            <View style={styles.blocker}>
              <Text style={styles.blockerTitle}>Vor Veröffentlichung prüfen</Text>
              <Text style={styles.blockerText}>
                {!result.privacyScanComplete
                  ? "Die visuelle Privatsphäre-Prüfung konnte nicht vollständig durchgeführt werden."
                  : result.blockingIssues.join(" · ")}
              </Text>
              {!privacyAcknowledged && (
                <Pressable
                  style={styles.ackButton}
                  onPress={onAcknowledgePrivacy}
                >
                  <Text style={styles.ackText}>
                    Ich habe die betroffenen Fotos selbst geprüft
                  </Text>
                </Pressable>
              )}
              {privacyAcknowledged && (
                <Text style={styles.acknowledged}>
                  Manuell geprüft ✓
                </Text>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dedede",
    borderRadius: 18,
    padding: 15,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#666",
  },
  title: { fontSize: 18, fontWeight: "900", marginTop: 4, color: "#171717" },
  muted: { color: "#666", lineHeight: 19, marginTop: 5 },
  primary: {
    backgroundColor: "#171717",
    borderRadius: 13,
    padding: 13,
    alignItems: "center",
    marginTop: 13,
  },
  primaryText: { color: "#fff", fontWeight: "900" },
  disabled: { opacity: 0.5 },
  busyRow: { flexDirection: "row", gap: 9, alignItems: "center" },
  summary: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    backgroundColor: "#f4f4f1",
    borderRadius: 13,
    padding: 12,
    marginTop: 13,
  },
  score: { fontSize: 27, fontWeight: "900" },
  scoreLabel: { fontSize: 10, color: "#777", fontWeight: "800" },
  summaryTitle: { fontWeight: "900", color: "#222" },
  summaryText: { color: "#666", fontSize: 12, marginTop: 3 },
  secondary: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 12,
    padding: 11,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryText: { fontWeight: "800", color: "#333" },
  photoRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  photoNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#171717",
    alignItems: "center",
    justifyContent: "center",
  },
  photoNumberText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 7 },
  photoTitle: { flex: 1, fontWeight: "800", color: "#333", fontSize: 12 },
  ok: { color: "#2d6333", fontWeight: "900", fontSize: 10 },
  warning: { color: "#982d22", fontWeight: "900", fontSize: 10 },
  detail: { color: "#666", fontSize: 11, lineHeight: 16, marginTop: 3 },
  risk: { color: "#982d22", fontSize: 11, fontWeight: "800", marginTop: 4 },
  tipBox: { backgroundColor: "#f5f5f2", borderRadius: 11, padding: 10, marginTop: 13 },
  tipTitle: { fontWeight: "900", color: "#333" },
  blocker: {
    backgroundColor: "#fff1ed",
    borderWidth: 1,
    borderColor: "#d7a399",
    borderRadius: 12,
    padding: 11,
    marginTop: 13,
  },
  blockerTitle: { color: "#8f2d20", fontWeight: "900" },
  blockerText: { color: "#74453d", lineHeight: 17, marginTop: 4, fontSize: 12 },
  ackButton: {
    borderWidth: 1,
    borderColor: "#a65b4e",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    marginTop: 10,
  },
  ackText: { color: "#7d3125", fontWeight: "900", fontSize: 12 },
  acknowledged: { color: "#2d6333", fontWeight: "900", marginTop: 9 },
});
