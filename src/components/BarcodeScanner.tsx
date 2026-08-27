import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

type Props = {
  onScanned: (value: string, type: string) => void;
  onCancel: () => void;
};

export function BarcodeScanner({ onScanned, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permission}>
        <Text style={styles.title}>Kamera freigeben</Text>
        <Text style={styles.muted}>
          Für EAN/Barcode-Scan benötigt die App Kamerazugriff.
        </Text>
        <Pressable style={styles.primary} onPress={requestPermission}>
          <Text style={styles.primaryText}>Kamera erlauben</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={onCancel}>
          <Text style={styles.secondaryText}>Abbrechen</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"],
        }}
        onBarcodeScanned={
          locked
            ? undefined
            : ({ data, type }) => {
                setLocked(true);
                onScanned(data, type);
              }
        }
      />

      <View style={styles.overlay}>
        <Text style={styles.cameraTitle}>Barcode / EAN scannen</Text>
        <Text style={styles.cameraText}>
          Halte den Code vollständig in den Rahmen.
        </Text>
        <View style={styles.frame} />
        <Pressable style={styles.cancel} onPress={onCancel}>
          <Text style={styles.cancelText}>Abbrechen</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  permission: {
    flex: 1,
    backgroundColor: "#f6f6f4",
    padding: 24,
    justifyContent: "center",
  },
  title: { fontSize: 26, fontWeight: "900", color: "#171717" },
  muted: { color: "#666", lineHeight: 21, marginTop: 8 },
  primary: {
    backgroundColor: "#171717",
    borderRadius: 14,
    padding: 15,
    alignItems: "center",
    marginTop: 18,
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
  secondaryText: { fontWeight: "800" },
  overlay: {
    flex: 1,
    padding: 24,
    paddingTop: 70,
    backgroundColor: "rgba(0,0,0,.22)",
    alignItems: "center",
  },
  cameraTitle: { color: "#fff", fontWeight: "900", fontSize: 25 },
  cameraText: { color: "#eee", textAlign: "center", marginTop: 7 },
  frame: {
    width: "88%",
    height: 180,
    borderWidth: 3,
    borderColor: "#fff",
    borderRadius: 18,
    marginTop: 90,
  },
  cancel: {
    position: "absolute",
    bottom: 42,
    backgroundColor: "#fff",
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
  },
  cancelText: { fontWeight: "900", color: "#171717" },
});
