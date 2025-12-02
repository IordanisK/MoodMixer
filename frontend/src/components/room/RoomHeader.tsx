import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { colors, spacing } from "../../theme";
import PresenceAvatars from "./PresenceAvatars";

type Props = {
  roomName: string;
  socketConnected: boolean | null;
  roomUsers: number;
  spotifyReady: boolean;
  isRoomCreator: boolean | null;
  onInvite: () => void;
  onConnectSpotify: () => void;
  headerAnimStyle: any;
};

export default function RoomHeader({
  roomName,
  socketConnected,
  roomUsers,
  spotifyReady,
  isRoomCreator,
  onInvite,
  onConnectSpotify,
  headerAnimStyle,
}: Props) {
  return (
    <Animated.View style={[styles.header, headerAnimStyle]}>
      <View style={styles.headerTopRow}>
        <View>
          <Text style={styles.roomBadge}>Room</Text>
          <Text style={styles.roomTitle}>{roomName}</Text>
        </View>

        <View style={styles.liveRow}>
          <View
            style={[
              styles.liveDot,
              socketConnected ?? false ? styles.liveDotOn : styles.liveDotOff,
            ]}
          />
          <Text style={styles.liveText}>
            {socketConnected ?? false ? "Live" : "Offline"}
          </Text>
        </View>
      </View>

      <View style={styles.headerBottomRow}>
        <Text style={styles.roomSubtitle}>
          Drop tracks, vote the vibe, build the mix.
        </Text>
        <View style={styles.headerActions}>
          <PresenceAvatars count={roomUsers} />
          {isRoomCreator && (
            <TouchableOpacity onPress={onInvite} style={styles.inviteButton}>
              <Text style={styles.inviteButtonText}>Invite</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onConnectSpotify}>
            <Text style={styles.connectSpotifyText}>
              {spotifyReady ? "✓ Spotify Connected" : "Connect Spotify"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.md,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  roomBadge: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  roomTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    marginTop: 2,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveDotOn: {
    backgroundColor: "#10b981",
  },
  liveDotOff: {
    backgroundColor: colors.textMuted,
  },
  liveText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "500",
  },
  roomSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    flex: 1,
  },
  inviteButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(59,130,246,0.2)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.5)",
  },
  inviteButtonText: {
    color: colors.accentSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  connectSpotifyText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});

