import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  LISTING_STATUS_LABELS,
  LISTING_STATUS_ORDER,
  ListingStatus,
  canTransition,
} from "../types/lifecycle";
import { ListingRecord } from "../types/salesCenter";

type Props = {
  record: ListingRecord;
  onChange: (next: ListingStatus) => void;
};

export function LifecyclePanel({ record, onChange }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>ARTIKEL-LEBENSZYKLUS</Text>
      <Text style={styles.title}>{LISTING_STATUS_LABELS[record.status]}</Text>

      <View style={styles.steps}>
        {LISTING_STATUS_ORDER.map((status) => {
          const active = record.status === status;
          const allowed = canTransition(record.status, status);

          return (
            <Pressable
              key={status}
              disabled={!allowed}
              onPress={() => onChange(status)}
              style={[
                styles.step,
                active && styles.stepActive,
                !active && !allowed && styles.stepDisabled,
              ]}
            >
              <Text
                style={[
                  styles.stepText,
                  active && styles.stepTextActive,
                ]}
              >
                {LISTING_STATUS_LABELS[status]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {record.lifecycleHistory && record.lifecycleHistory.length > 0 && (
        <View style={styles.history}>
          <Text style={styles.historyTitle}>Historie</Text>
          {record.lifecycleHistory
            .slice()
            .reverse()
            .slice(0, 8)
            .map((event) => (
              <View key={event.id} style={styles.historyRow}>
                <View style={styles.dot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyText}>
                    {event.from
                      ? `${LISTING_STATUS_LABELS[event.from]} → ${LISTING_STATUS_LABELS[event.to]}`
                      : LISTING_STATUS_LABELS[event.to]}
                  </Text>
                  <Text style={styles.historyDate}>
                    {new Date(event.changedAt).toLocaleString("de-DE")}
                  </Text>
                  {event.note ? (
                    <Text style={styles.historyNote}>{event.note}</Text>
                  ) : null}
                </View>
              </View>
            ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
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
    marginTop: 4,
  },
  steps: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 12,
  },
  step: {
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  stepActive: {
    backgroundColor: "#171717",
    borderColor: "#171717",
  },
  stepDisabled: {
    opacity: 0.35,
  },
  stepText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#333",
  },
  stepTextActive: {
    color: "#fff",
  },
  history: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
  },
  historyTitle: {
    fontWeight: "900",
    color: "#333",
  },
  historyRow: {
    flexDirection: "row",
    gap: 9,
    marginTop: 10,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#171717",
    marginTop: 4,
  },
  historyText: {
    fontWeight: "800",
    color: "#333",
    fontSize: 12,
  },
  historyDate: {
    color: "#777",
    fontSize: 10,
    marginTop: 2,
  },
  historyNote: {
    color: "#666",
    fontSize: 10,
    marginTop: 2,
  },
});
