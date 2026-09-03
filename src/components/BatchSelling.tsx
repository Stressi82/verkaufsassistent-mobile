import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { BatchItem } from "../types/batch";
import { PhotoItem } from "../types/listing";

type Props = {
  busy: boolean;
  progressText: string;
  onCancel: () => void;
  onProcess: (items: BatchItem[]) => void;
  onLoadDemo: () => void;
};

const id = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function BatchSelling({
  busy,
  progressText,
  onCancel,
  onProcess,
  onLoadDemo,
}: Props) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [label, setLabel] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  const totalPhotos = useMemo(
    () => items.reduce((sum, item) => sum + item.photos.length, 0) + photos.length,
    [items, photos]
  );

  const addPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      orderedSelection: true,
      selectionLimit: Math.max(1, 6 - photos.length),
      quality: 0.85,
    });

    if (!result.canceled) {
      setPhotos((current) => [
        ...current,
        ...result.assets
          .slice(0, Math.max(0, 6 - current.length))
          .map((asset) => ({ id: id(), uri: asset.uri, role: "general" as const })),
      ]);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Kamera", "Bitte erlaube den Kamerazugriff.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      cameraType: ImagePicker.CameraType.back,
    });

    const asset = result.canceled ? undefined : result.assets[0];
    if (asset && photos.length < 6) {
      setPhotos((current) => [
        ...current,
        { id: id(), uri: asset.uri, role: "general" },
      ]);
    }
  };

  const finishItem = () => {
    if (!photos.length) {
      Alert.alert("Stapelverkauf", "Füge für diesen Artikel mindestens ein Foto hinzu.");
      return;
    }

    const next: BatchItem = {
      id: id(),
      label: label.trim() || `Artikel ${items.length + 1}`,
      photos,
    };
    setItems((current) => [...current, next]);
    setLabel("");
    setPhotos([]);
  };

  const removeItem = (itemId: string) => {
    setItems((current) => current.filter((item) => item.id !== itemId));
  };

  const allItems =
    photos.length > 0
      ? [
          ...items,
          {
            id: "current",
            label: label.trim() || `Artikel ${items.length + 1}`,
            photos,
          },
        ]
      : items;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>STAPELVERKAUF</Text>
      <Text style={styles.title}>Viele Artikel hintereinander</Text>
      <Text style={styles.muted}>
        Fotografiere einen Gegenstand, lege ihn in den Stapel und gehe direkt
        zum nächsten. Am Ende werden alle Artikel nacheinander analysiert und
        als Entwürfe gespeichert.
      </Text>

      <View style={styles.stats}>
        <Text style={styles.statsText}>
          {items.length} fertig · {totalPhotos} Fotos
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Artikel {items.length + 1}
        </Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="Kurzer Name optional, z. B. Bohrmaschine"
          style={styles.input}
        />

        <View style={styles.photoRow}>
          {photos.map((photo) => (
            <Image key={photo.id} source={{ uri: photo.uri }} style={styles.photo} />
          ))}
          {photos.length === 0 && (
            <View style={[styles.photo, styles.placeholder]}>
              <Text>📦</Text>
            </View>
          )}
        </View>

        <View style={styles.buttonRow}>
          <Pressable style={styles.halfButton} onPress={takePhoto}>
            <Text style={styles.halfButtonText}>📸 Foto</Text>
          </Pressable>
          <Pressable style={styles.halfButton} onPress={addPhotos}>
            <Text style={styles.halfButtonText}>Galerie</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.primary, !photos.length && styles.disabled]}
          disabled={!photos.length || busy}
          onPress={finishItem}
        >
          <Text style={styles.primaryText}>Artikel fertig → nächster</Text>
        </Pressable>
      </View>

      {items.map((item, index) => (
        <View key={item.id} style={styles.itemCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>
              {index + 1}. {item.label}
            </Text>
            <Text style={styles.itemMeta}>
              {item.photos.length} Foto{item.photos.length === 1 ? "" : "s"}
            </Text>
          </View>
          <Pressable onPress={() => removeItem(item.id)} disabled={busy}>
            <Text style={styles.remove}>Entfernen</Text>
          </Pressable>
        </View>
      ))}

      <Pressable style={styles.secondary} onPress={onLoadDemo} disabled={busy}>
        <Text style={styles.secondaryText}>Demo-Stapel mit 3 Artikeln laden</Text>
      </Pressable>

      {busy && (
        <View style={styles.progress}>
          <Text style={styles.progressTitle}>Stapel wird verarbeitet</Text>
          <Text style={styles.progressText}>{progressText}</Text>
        </View>
      )}

      <Pressable
        style={[
          styles.process,
          (allItems.length === 0 || busy) && styles.disabled,
        ]}
        disabled={allItems.length === 0 || busy}
        onPress={() => onProcess(allItems)}
      >
        <Text style={styles.processText}>
          {allItems.length} Artikel analysieren & als Entwürfe speichern
        </Text>
      </Pressable>

      <Pressable style={styles.secondary} onPress={onCancel} disabled={busy}>
        <Text style={styles.secondaryText}>Zur Verkaufszentrale</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 50, backgroundColor: "#f6f6f4" },
  eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1.3, color: "#666" },
  title: { fontSize: 30, lineHeight: 35, fontWeight: "900", marginTop: 6 },
  muted: { color: "#666", lineHeight: 21, marginTop: 7 },
  stats: {
    alignSelf: "flex-start",
    backgroundColor: "#171717",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginTop: 14,
  },
  statsText: { color: "#fff", fontWeight: "900", fontSize: 11 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 18,
    padding: 15,
    marginTop: 15,
  },
  cardTitle: { fontSize: 18, fontWeight: "900" },
  input: {
    borderWidth: 1,
    borderColor: "#d5d5d5",
    borderRadius: 12,
    padding: 11,
    marginTop: 10,
  },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 11 },
  photo: { width: 68, height: 68, borderRadius: 10, backgroundColor: "#eee" },
  placeholder: { alignItems: "center", justifyContent: "center" },
  buttonRow: { flexDirection: "row", gap: 9, marginTop: 11 },
  halfButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 11,
    padding: 11,
    alignItems: "center",
  },
  halfButtonText: { fontWeight: "800", color: "#333" },
  primary: {
    backgroundColor: "#171717",
    borderRadius: 13,
    padding: 13,
    alignItems: "center",
    marginTop: 12,
  },
  primaryText: { color: "#fff", fontWeight: "900" },
  disabled: { opacity: 0.45 },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 13,
    padding: 12,
    marginTop: 9,
  },
  itemTitle: { fontWeight: "900" },
  itemMeta: { color: "#777", fontSize: 11, marginTop: 3 },
  remove: { color: "#9a2d21", fontWeight: "800", fontSize: 12 },
  secondary: {
    borderWidth: 1,
    borderColor: "#c7c7c7",
    borderRadius: 13,
    padding: 12,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryText: { fontWeight: "800", color: "#333" },
  progress: {
    backgroundColor: "#fff6e8",
    borderRadius: 13,
    padding: 12,
    marginTop: 13,
  },
  progressTitle: { fontWeight: "900", color: "#76501f" },
  progressText: { color: "#76501f", marginTop: 4 },
  process: {
    backgroundColor: "#171717",
    borderRadius: 15,
    padding: 16,
    alignItems: "center",
    marginTop: 14,
  },
  processText: { color: "#fff", fontWeight: "900", textAlign: "center" },
});
