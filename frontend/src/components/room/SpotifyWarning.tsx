import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "../../theme";
import PrimaryButton from "../PrimaryButton";

type Props = {
  visible: boolean;
  onConnect?: () => void;
  connecting?: boolean;
};

export default function SpotifyWarning({ visible, onConnect, connecting }: Props) {
  if (!visible) return null;

  return (
    <View style={styles.spotifyWarning}>
      <Text style={styles.spotifyWarningText}>
        ⚠️ Connect Spotify to hear this track playing
      </Text>
      <Text style={styles.spotifyWarningSubtext}>
        Other users can already hear the track. Connect to join them!
      </Text>
      {onConnect && (
        <View style={styles.buttonContainer}>
          <PrimaryButton
            title="Connect Spotify"
            onPress={onConnect}
            loading={connecting}
          />
        </View>
      )}
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
    marginBottom: spacing.xs,
  },
  spotifyWarningSubtext: {
    color: "rgba(252,165,165,0.8)",
    fontSize: 12,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  buttonContainer: {
    marginTop: spacing.xs,
  },
});

