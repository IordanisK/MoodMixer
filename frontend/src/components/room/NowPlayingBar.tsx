import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Track } from "../../api/rooms";
import { TrackMetadata } from "../../api/metadata";
import { colors, radii, RoomThemeId, roomThemes, spacing } from "../../theme";

export type NowPlayingBarProps = {
  track?: Track; 
  meta?: TrackMetadata; 
  roomTheme: RoomThemeId;
  settingNowPlayingFor: string | null;
  onClear: () => void;
  onSkip: () => void;
};

const NowPlayingBar: React.FC<NowPlayingBarProps> = ({
  track,
  meta,
  roomTheme,
  settingNowPlayingFor,
  onClear,
  onSkip,
}) => {
  const theme = roomThemes[roomTheme] || roomThemes.synthwave;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!track) return;

    pulse.setValue(0);
    Animated.timing(pulse, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(pulse, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start();
    });
  }, [track?.id]);

  const pulseStyle = {
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.03],
        }),
      },
    ],
    shadowOpacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.8],
    }),
  };

  return (
    <Animated.View style={[styles.card, pulseStyle,
      {
          borderColor: theme.accentSoft,
          shadowColor: theme.glow,
      },
    ]}>
      <Text style={[styles.label, { color: theme.accent }]}>Now playing</Text>
      {track ? (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.title}>
              {meta?.title || track.url}
            </Text>
            {meta?.author ? (
              <Text style={styles.subtitle}>{meta.author}</Text>
            ) : track.note ? (
              <Text style={styles.subtitle}>{track.note}</Text>
            ) : null}
          </View>
          <View style={styles.controls}>
            <TouchableOpacity
              onPress={onSkip}
              style={styles.skipButton}
            >
              <Text style={styles.skipText}>Skip ⏭</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClear}
              disabled={settingNowPlayingFor === "clear"}
            >
              <Text style={styles.clearText}>
                {settingNowPlayingFor === "clear" ? "Clearing..." : "Clear"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={styles.subtitle}>
          No track crowned yet. Tap a track below and set it as DJ 🎧
        </Text>
      )}
    </Animated.View>
  );
};

export default NowPlayingBar;

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(129,140,248,0.5)",
    marginBottom: spacing.md,
    shadowColor: colors.accentSecondary,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  skipButton: {
    backgroundColor: "rgba(99,102,241,0.2)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  skipText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  clearText: {
    color: colors.accentSecondary,
    fontSize: 12,
    marginLeft: spacing.sm,
  },
});
