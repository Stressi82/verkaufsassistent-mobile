import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { PhotoItem } from "../types/listing";

type Props = {
  photo: PhotoItem;
  isCover: boolean;
  onMakeCover: () => void;
  onRemove: () => void;
};

export function PhotoTile({ photo, isCover, onMakeCover, onRemove }: Props) {
  const roleLabel =
    photo.role === "typeplate"
      ? "Typenschild"
      : photo.role === "damage"
        ? "Schaden"
        : photo.role === "accessories"
          ? "Zubehör"
          : null;

  return (
    <View style={styles.card}>
      <Pressable onPress={onMakeCover}>
        <Image source={{ uri: photo.uri }} style={styles.image} />
        {isCover && <Text style={styles.cover}>Titelbild</Text>}
        {!isCover && roleLabel && (
          <Text style={styles.role}>{roleLabel}</Text>
        )}
      </Pressable>
      <Pressable onPress={onRemove} style={styles.remove}>
        <Text style={styles.removeText}>Entfernen</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 138,
    marginRight: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#dedede",
  },
  image: { width: "100%", height: 120 },
  cover: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,.72)",
    color: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "700",
  },
  role: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: "rgba(255,255,255,.9)",
    color: "#222",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 11,
    fontWeight: "800",
  },
  remove: { padding: 10, alignItems: "center" },
  removeText: { color: "#9f1d1d", fontWeight: "600" },
});
