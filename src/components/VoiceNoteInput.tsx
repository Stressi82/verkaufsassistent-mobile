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
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { AIProviderId } from "../types/ai";
import { transcribeVoiceNote } from "../services/voiceNotes";

type Props = {
  provider: AIProviderId;
  value: string;
  onChange: (value: string) => void;
};

export function VoiceNoteInput({ provider, value, onChange }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
    }).catch(() => undefined);
  }, []);

  const start = async () => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Mikrofon", "Bitte erlaube den Mikrofonzugriff.");
      return;
    }

    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const stop = async () => {
    setBusy(true);
    try {
      await recorder.stop();
      if (!recorder.uri) return;

      const text = await transcribeVoiceNote(recorder.uri, provider);
      if (text.trim()) {
        onChange([value.trim(), text.trim()].filter(Boolean).join("\n"));
      }
    } catch (error) {
      Alert.alert(
        "Sprachangabe",
        error instanceof Error
          ? `${error.message}\n\nDu kannst die Angabe darunter auch manuell eintippen.`
          : "Transkription fehlgeschlagen."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🎙️ Produktangaben sprechen</Text>
      <Text style={styles.muted}>
        Zum Beispiel: „Funktioniert, Akku hält gut, rechts ist ein Kratzer,
        Ladegerät ist dabei.“
      </Text>

      <Pressable
        style={[styles.recordButton, state.isRecording && styles.recording]}
        disabled={busy}
        onPress={state.isRecording ? stop : start}
      >
        <Text style={styles.recordText}>
          {busy
            ? "Wird in Text umgewandelt …"
            : state.isRecording
              ? "■ Aufnahme stoppen"
              : "● Spracheingabe starten"}
        </Text>
      </Pressable>

      <TextInput
        multiline
        value={value}
        onChangeText={onChange}
        placeholder="Gesprochene oder manuelle Zusatzangaben …"
        style={styles.input}
      />

      <Text style={styles.note}>
        Die Notiz ergänzt die Fotoanalyse. Sie ersetzt keine sichtbaren Fakten.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dedede",
    borderRadius: 16,
    padding: 15,
  },
  title: { fontWeight: "900", fontSize: 16, color: "#222" },
  muted: { color: "#666", lineHeight: 19, marginTop: 5 },
  recordButton: {
    backgroundColor: "#171717",
    borderRadius: 13,
    padding: 13,
    alignItems: "center",
    marginTop: 12,
  },
  recording: { backgroundColor: "#7d2525" },
  recordText: { color: "#fff", fontWeight: "900" },
  input: {
    minHeight: 85,
    borderWidth: 1,
    borderColor: "#d4d4d4",
    borderRadius: 12,
    padding: 11,
    marginTop: 12,
    textAlignVertical: "top",
  },
  note: { color: "#888", fontSize: 11, lineHeight: 16, marginTop: 7 },
});
