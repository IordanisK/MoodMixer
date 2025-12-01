import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
} from "react-native";
import { Track } from "../../api/rooms";
import { TrackMetadata } from "../../api/metadata";
import { colors, radii, RoomThemeId, roomThemes, spacing } from "../../theme";

type Props = {
  tracks: Track[];
  loading: boolean;
  nowPlayingId: string | null;
  trackMeta: Record<string, TrackMetadata>;
  roomTheme: RoomThemeId;
  onVote: (trackId: string, value: 1 | -1) => void;
  onSetNowPlaying: (trackId: string) => void;
  settingNowPlayingFor: string | null;
};

export default function TrackList({
  tracks,
  loading,
  nowPlayingId,
  trackMeta,
  roomTheme,
  onVote,
  onSetNowPlaying,
  settingNowPlayingFor,
}: Props) {
  const theme = roomThemes[roomTheme] || roomThemes.synthwave;
  return (
    <View style={{ marginTop: spacing.lg }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          {loading ? "Loading tracks..." : "Tracks in this room"}
        </Text>
        <Text style={styles.subtitle}>
          Tap 👍 / 👎 and set DJ picks.
        </Text>
      </View>

      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        contentContainerStyle={{ paddingBottom: spacing.lg }}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              No tracks yet. Be the first DJ in here 🎧
            </Text>
          ) : null
        }
        renderItem={({ item, index }) => {
          const itemAnim = new Animated.Value(0);
          Animated.timing(itemAnim, {
            toValue: 1,
            duration: 300,
            delay: index * 60,
            useNativeDriver: true,
          }).start();

          const isNowPlaying = nowPlayingId === item.id;
          const meta = trackMeta[item.id];

          return (
            <Animated.View
              style={{
                opacity: itemAnim,
                transform: [
                  {
                    translateY: itemAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              }}
            >
              <View
                style={[
                  styles.trackCard,
                  isNowPlaying && styles.trackCardNowPlaying && {borderColor : theme.accent},
                ]}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.trackPreviewRow}>
                    {meta?.thumbnail ? (
                      <Image
                        source={{ uri: meta.thumbnail }}
                        style={styles.trackThumbnail}
                      />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={styles.trackTitle}
                      >
                        {meta?.title || item.url}
                      </Text>
                      {meta?.author || item.note ? (
                        <Text
                          style={styles.trackAuthor}
                          numberOfLines={1}
                        >
                          {meta?.author || item.note}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => onSetNowPlaying(item.id)}
                    disabled={settingNowPlayingFor === item.id}
                  >
                    <Text style={styles.setNowPlayingText}>
                      {settingNowPlayingFor === item.id
                        ? "Setting…"
                        : isNowPlaying
                        ? "Now playing ✅"
                        : "Set as now playing"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.voteColumn}>
                  <TouchableOpacity
                    onPress={() => onVote(item.id, 1)}
                    activeOpacity={0.7}
                    style={styles.voteButton}
                  >
                    <Text style={styles.voteText}>👍</Text>
                    <Text style={styles.voteCount}>{item.upvotes}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onVote(item.id, -1)}
                    activeOpacity={0.7}
                    style={styles.voteButton}
                  >
                    <Text style={styles.voteText}>👎</Text>
                    <Text style={styles.voteCount}>{item.downvotes}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.md,
    textAlign: "center",
  },
  trackCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(55,65,81,0.9)",
  },
  trackCardNowPlaying: {
    borderColor: colors.accentSecondary,
  },
  trackPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  trackThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: spacing.md,
  },
  trackTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  trackAuthor: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  setNowPlayingText: {
    color: colors.accent,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  voteColumn: {
    marginLeft: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  voteButton: {
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  voteText: {
    fontSize: 16,
  },
  voteCount: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
