import React, { useState, memo } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import PrimaryButton from "../PrimaryButton";
import { colors, radii, spacing } from "../../theme";

type Props = {
  adding: boolean;
  onAdd: (url: string, note: string) => void | Promise<void>;
};

// Memoized to prevent re-renders from parent
const AddTrackCard = memo(function AddTrackCard({ adding, onAdd }: Props) {
  // Keep input state local to prevent parent re-renders
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");

  const handleAdd = async () => {
    if (!url.trim()) return;
    await onAdd(url, note);
    // Clear inputs after successful add
    setUrl("");
    setNote("");
  };

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
          autoCapitalize="none"
          autoCorrect={false}
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
        onPress={handleAdd}
        loading={adding}
        disabled={!url.trim()}
      />
    </View>
  );
});

export default AddTrackCard;

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
