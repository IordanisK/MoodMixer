import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import GradientBackground from "../components/GradientBackground";
import RoomSceneLayer from "../components/room/RoomSceneLayer";
import { colors, spacing } from "../theme";
import { useRoomDetail } from "../hooks/useRoomDetail";
import NowPlayingBar from "../components/room/NowPlayingBar";
import AddTrackCard from "../components/room/AddTrackCard";
import MoodStrip from "../components/room/MoodStrip";
import TrackList from "../components/room/TrackList";
import RoomThemePicker from "../components/room/RoomThemePicker";
import { useRoomChat } from "../hooks/useRoomChat";
import RoomChat from "../components/room/RoomChat";
import PresenceAvatars from "../components/room/PresenceAvatars";
import WebNowPlayingPlayer from "../components/room/WebNowPlayingPlayer";
import { useSpotifyPlayer } from "../spotify/useSpotifyPlayer";
import api from "../api/client";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "../context/AuthContext";
import {
  inviteUserToRoom,
  regenerateRoomCode,
  fetchRoom,
  fetchRoomBySlug,
} from "../api/rooms";
import PrimaryButton from "../components/PrimaryButton";

type Props = NativeStackScreenProps<RootStackParamList, "RoomDetail">;

export default function RoomDetailScreen({ route }: Props) {
  const { slug } = route.params;
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string>("");
  const [loadingRoom, setLoadingRoom] = useState(true);

  // Fetch room by slug to get roomId
  useEffect(() => {
    const loadRoomBySlug = async () => {
      try {
        setLoadingRoom(true);
        const room = await fetchRoomBySlug(slug);
        setRoomId(room.id);
        setRoomName(room.name);
      } catch (e: any) {
        console.log("Error loading room by slug", e);
        Alert.alert("Error", "Room not found");
      } finally {
        setLoadingRoom(false);
      }
    };
    loadRoomBySlug();
  }, [slug]);

  // Only call hooks when we have a roomId
  const roomDetail = useRoomDetail(roomId || "");
  const roomChat = useRoomChat(roomId || "");

  const {
    tracks,
    moodItems,
    loadingTracks,
    loadingMood,
    url,
    note,
    adding,
    nowPlayingId,
    nowPlayingTrack,
    nowPlayingMeta,
    nowPlayingStartedAt,
    settingNowPlayingFor,
    socketConnected,
    roomUsers,
    trackMeta,
    roomTheme,
    roomCreatedBy,
    roomCode,
    setUrl,
    setNote,
    handleAddTrack,
    handleVote,
    handleSelectGif,
    handleSetNowPlaying,
    handleClearNowPlaying,
    handleChangeTheme,
  } = roomDetail;

  const { user } = useAuth();
  const isRoomCreator = user && roomCreatedBy === user.uid;

  const {
    messages,
    loading: chatLoading,
    sending: chatSending,
    handleSend,
  } = roomChat;

  const { isReady: spotifyReady, playSpotifyTrack } = useSpotifyPlayer();

  const headerAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView | null>(null);
  const [tracksSectionY, setTracksSectionY] = useState(0);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, []);

  const headerAnimStyle = {
    opacity: headerAnim,
    transform: [
      {
        translateY: headerAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
  };

  const handleJumpToTracks = () => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      y: tracksSectionY,
      animated: true,
    });
  };

  useEffect(() => {
    if (Platform.OS !== "web") {
      console.log("Not on web platform, skipping Spotify playback");
      return;
    }

    if (!nowPlayingTrack) {
      console.log("No now playing track");
      return;
    }

    if (
      nowPlayingTrack.provider !== "spotify" &&
      !(nowPlayingTrack.url && nowPlayingTrack.url.includes("spotify.com"))
    ) {
      console.log(
        "Track is not a Spotify track",
        nowPlayingTrack.provider,
        nowPlayingTrack.url
      );
      return;
    }

    if (!spotifyReady) {
      console.log("Spotify player not ready yet");
      return;
    }

    console.log(
      "Attempting to play Spotify track for all users:",
      nowPlayingTrack.url,
      "startedAt:",
      nowPlayingStartedAt
    );

    const playTrack = async () => {
      try {
        if (!nowPlayingStartedAt) {
          // fallback: start from 0 if we don't have a timestamp
          await playSpotifyTrack(nowPlayingTrack.url, 0);
        } else {
          const offsetSeconds = Math.max(
            0,
            (Date.now() - nowPlayingStartedAt) / 1000
          );
          await playSpotifyTrack(nowPlayingTrack.url, offsetSeconds);
        }
      } catch (e: any) {
        console.error("Error playing Spotify track:", e);
        const errorMessage = e.message || "Failed to play Spotify track";

        // Show user-friendly error message
        if (Platform.OS === "web") {
          alert(`Spotify Playback Error\n\n${errorMessage}`);
        } else {
          Alert.alert("Spotify Playback Error", errorMessage);
        }
      }
    };

    playTrack();
  }, [
    nowPlayingTrack?.id,
    nowPlayingTrack?.url,
    nowPlayingStartedAt,
    spotifyReady,
    playSpotifyTrack,
  ]);

  async function handleConnectSpotify() {
    try {
      const res = await api.post("/spotify/login-url");
      const { url } = res.data;
      if (Platform.OS === "web") {
        window.location.href = url;
      } else {
        await WebBrowser.openBrowserAsync(url);
      }
    } catch (e) {
      console.log("Error starting Spotify login", e);
    }
  }

  async function handleInviteUser() {
    if (!roomId || !inviteEmail.trim()) {
      Alert.alert("Hold up 🛑", "Please enter an email address");
      return;
    }

    try {
      setInviting(true);
      await inviteUserToRoom(roomId, inviteEmail.trim());
      Alert.alert("Success 🎉", "User invited successfully!");
      setInviteEmail("");
      setShowInviteModal(false);
    } catch (e: any) {
      console.log("Error inviting user", e);
      const errorMessage =
        e.response?.data?.error || "Failed to invite user. Please try again.";
      Alert.alert("Oops 💥", errorMessage);
    } finally {
      setInviting(false);
    }
  }

  async function handleCopyRoomCode() {
    if (!roomCode) return;

    try {
      if (Platform.OS === "web") {
        await navigator.clipboard.writeText(roomCode);
      } else {
        // For React Native, we'll use a simple approach
        // Users can manually copy if needed, or we can add @react-native-clipboard/clipboard later
        Alert.alert("Room Code", roomCode, [{ text: "OK", style: "default" }]);
        return;
      }
      Alert.alert("Copied! 📋", `Room code ${roomCode} copied to clipboard`);
    } catch (e) {
      // Fallback: just show the code
      Alert.alert("Room Code", roomCode);
    }
  }

  async function handleRegenerateCode() {
    if (!roomId) return;
    try {
      setRegenerating(true);
      const result = await regenerateRoomCode(roomId);
      // Room code will be updated via socket events or on next room load
      const message = roomCode
        ? `New room code: ${result.roomCode}`
        : `Room code generated: ${result.roomCode}`;
      Alert.alert("Success 🎉", message);
    } catch (e: any) {
      console.log("Error generating/regenerating code", e);
      const errorMessage =
        e.response?.data?.error || "Failed to generate code. Please try again.";
      Alert.alert("Oops 💥", errorMessage);
    } finally {
      setRegenerating(false);
    }
  }

  if (loadingRoom || !roomId) {
    return (
      <GradientBackground themeId={roomTheme}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Text style={{ color: colors.text }}>Loading room...</Text>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground themeId={roomTheme}>
      <View style={{ flex: 1 }}>
        <RoomSceneLayer themeId={roomTheme} />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
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
                      socketConnected ? styles.liveDotOn : styles.liveDotOff,
                    ]}
                  />
                  <Text style={styles.liveText}>
                    {socketConnected ? "Live" : "Offline"}
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
                    <TouchableOpacity
                      onPress={() => setShowInviteModal(true)}
                      style={styles.inviteButton}
                    >
                      <Text style={styles.inviteButtonText}>Invite</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={handleConnectSpotify}>
                    <Text style={styles.connectSpotifyText}>
                      {spotifyReady ? "✓ Spotify Connected" : "Connect Spotify"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>

            <RoomThemePicker value={roomTheme} onChange={handleChangeTheme} />

            {isRoomCreator && (
              <View style={styles.roomCodeCard}>
                {roomCode ? (
                  <>
                    <View style={styles.roomCodeHeader}>
                      <Text style={styles.roomCodeLabel}>Room Code</Text>
                      <TouchableOpacity
                        onPress={handleRegenerateCode}
                        disabled={regenerating}
                        style={styles.regenerateButton}
                      >
                        <Text style={styles.regenerateText}>
                          {regenerating ? "Regenerating..." : "Regenerate"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      onPress={handleCopyRoomCode}
                      style={styles.roomCodeDisplay}
                    >
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
                      onPress={handleRegenerateCode}
                      loading={regenerating}
                    />
                  </>
                )}
              </View>
            )}

            {nowPlayingTrack &&
              nowPlayingTrack.provider === "spotify" &&
              !spotifyReady &&
              Platform.OS === "web" && (
                <View style={styles.spotifyWarning}>
                  <Text style={styles.spotifyWarningText}>
                    ⚠️ Connect Spotify to hear this track playing
                  </Text>
                </View>
              )}
            <NowPlayingBar
              track={nowPlayingTrack}
              meta={nowPlayingMeta}
              roomTheme={roomTheme}
              settingNowPlayingFor={settingNowPlayingFor}
              onClear={handleClearNowPlaying}
            />

            {nowPlayingTrack &&
              (nowPlayingTrack.provider === "youtube" ||
                (nowPlayingTrack.url &&
                  (nowPlayingTrack.url.includes("youtube.com") ||
                    nowPlayingTrack.url.includes("youtu.be")))) && (
                <WebNowPlayingPlayer
                  url={nowPlayingTrack.url}
                  startedAt={nowPlayingStartedAt}
                />
              )}

            <AddTrackCard
              url={url}
              note={note}
              setUrl={setUrl}
              setNote={setNote}
              adding={adding}
              onAdd={handleAddTrack}
            />

            <MoodStrip
              items={moodItems}
              loading={loadingMood}
              onSelectGif={handleSelectGif}
            />

            <RoomChat
              messages={messages}
              loading={chatLoading}
              sending={chatSending}
              onSend={handleSend}
              roomTheme={roomTheme}
            />

            <View onLayout={(e) => setTracksSectionY(e.nativeEvent.layout.y)}>
              <TrackList
                tracks={tracks}
                loading={loadingTracks}
                nowPlayingId={nowPlayingId}
                trackMeta={trackMeta}
                roomTheme={roomTheme}
                onVote={handleVote}
                onSetNowPlaying={handleSetNowPlaying}
                settingNowPlayingFor={settingNowPlayingFor}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {nowPlayingId && tracks.length > 0 && (
          <TouchableOpacity
            style={styles.fab}
            onPress={handleJumpToTracks}
            activeOpacity={0.85}
          >
            <Text style={styles.fabText}>Jump to track 🎧</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={showInviteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invite User</Text>
            <Text style={styles.modalSubtitle}>
              Enter the email address of the user you want to invite
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="user@example.com"
              placeholderTextColor={colors.textMuted}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setShowInviteModal(false);
                  setInviteEmail("");
                }}
                style={styles.modalCancelButton}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton
                title={inviting ? "Inviting..." : "Send Invite"}
                onPress={handleInviteUser}
                loading={inviting}
              />
            </View>
          </View>
        </View>
      </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
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
  spotifyWarning: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
  },
  spotifyWarningText: {
    color: "#ef4444",
    fontSize: 13,
    textAlign: "center",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: spacing.md,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  modalInput: {
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.cardSoft,
    marginBottom: spacing.md,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  modalCancelButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.sm,
  },
  modalCancelText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  roomBadge: {
    color: colors.accentSecondary,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  roomTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  roomSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 6,
  },
  liveDotOn: {
    backgroundColor: "#22c55e",
  },
  liveDotOff: {
    backgroundColor: colors.textMuted,
  },
  liveText: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  usersPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
  },
  usersPillText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg + (Platform.OS === "ios" ? 12 : 4),
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(59,130,246,0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  fabText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  roomCodeCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(75,85,99,0.6)",
    marginBottom: spacing.md,
  },
  roomCodeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  roomCodeLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  regenerateButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: spacing.xs,
    backgroundColor: "rgba(59,130,246,0.1)",
  },
  regenerateText: {
    color: colors.accentSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  roomCodeDisplay: {
    backgroundColor: colors.cardSoft,
    borderRadius: spacing.sm,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  roomCodeText: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginBottom: spacing.xs,
  },
  copyHint: {
    color: colors.textMuted,
    fontSize: 11,
  },
  roomCodeSubtext: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
  },
});
