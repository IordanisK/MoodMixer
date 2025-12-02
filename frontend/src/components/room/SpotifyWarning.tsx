import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "../../theme";

type Props = {
  visible: boolean;
};

export default function SpotifyWarning({ visible }: Props) {
  if (!visible) return null;

  return (
    <View style={styles.spotifyWarning}>
      <Text style={styles.spotifyWarningText}>
        ⚠️ Connect Spotify to hear this track playing
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  spotifyWarning: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  spotifyWarningText: {
    color: "#fca5a5",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
});

