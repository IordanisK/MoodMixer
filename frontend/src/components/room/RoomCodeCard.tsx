import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from "react-native";
import { colors, spacing } from "../../theme";
import PrimaryButton from "../PrimaryButton";

type Props = {
  roomCode: string | null;
  regenerating: boolean;
  onRegenerate: () => void;
  onCopy: () => void;
};

export default function RoomCodeCard({
  roomCode,
  regenerating,
  onRegenerate,
  onCopy,
}: Props) {
  return (
    <View style={styles.roomCodeCard}>
      {roomCode ? (
        <>
          <View style={styles.roomCodeHeader}>
            <Text style={styles.roomCodeLabel}>Room Code</Text>
            <TouchableOpacity
              onPress={onRegenerate}
              disabled={regenerating}
              style={styles.regenerateButton}
            >
              <Text style={styles.regenerateText}>
                {regenerating ? "Regenerating..." : "Regenerate"}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={onCopy} style={styles.roomCodeDisplay}>
            <Text style={styles.roomCodeText}>{roomCode}</Text>
            <Text style={styles.copyHint}>Tap to copy</Text>
          </TouchableOpacity>
          <Text style={styles.roomCodeSubtext}>
            Share this code with others to let them join your room
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.roomCodeLabel}>Room Code</Text>
          <Text style={styles.roomCodeSubtext}>
            Generate a shareable code so others can join your room
          </Text>
          <PrimaryButton
            title={regenerating ? "Generating..." : "Generate Code"}
            onPress={onRegenerate}
            loading={regenerating}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  roomCodeCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  roomCodeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  roomCodeLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  regenerateButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  regenerateText: {
    color: colors.accentSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  roomCodeDisplay: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  roomCodeText: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  copyHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  roomCodeSubtext: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});

