import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import PrimaryButton from "../PrimaryButton";
import { colors, radii, spacing } from "../../theme";

type Props = {
  url: string;
  note: string;
  setUrl: (v: string) => void;
  setNote: (v: string) => void;
  adding: boolean;
  onAdd: () => void | Promise<void>;
};

export default function AddTrackCard({
  url,
  note,
  setUrl,
  setNote,
  adding,
  onAdd,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Add a track</Text>
      <Text style={styles.cardSubtitle}>
        Paste a YouTube / Spotify link and an optional note.
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>Track URL</Text>
        <TextInput
          style={styles.input}
          placeholder="https://open.spotify.com/track/..."
          placeholderTextColor={colors.textMuted}
          value={url}
          onChangeText={setUrl}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Why this track fits the mood..."
          placeholderTextColor={colors.textMuted}
          value={note}
          onChangeText={setNote}
        />
      </View>

      <PrimaryButton
        title="Add to room"
        onPress={onAdd}
        loading={adding}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(75,85,99,0.7)",
    marginBottom: spacing.lg,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: "rgba(15,23,42,0.9)",
    fontSize: 14,
  },
});
