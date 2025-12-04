import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import GradientBackground from "../components/GradientBackground";
import RoomSceneLayer from "../components/room/RoomSceneLayer";
import { colors, spacing } from "../theme";
import { useRoomDetail } from "../hooks/useRoomDetail";
import NowPlayingBar from "../components/room/NowPlayingBar";
import AddTrackCard from "../components/room/AddTrackCard";
import TrackList from "../components/room/TrackList";
import RoomThemePicker from "../components/room/RoomThemePicker";
import { useRoomChat } from "../hooks/useRoomChat";
import RoomChat from "../components/room/RoomChat";
import WebNowPlayingPlayer from "../components/room/WebNowPlayingPlayer";
import RoomHeader from "../components/room/RoomHeader";
import RoomCodeCard from "../components/room/RoomCodeCard";
import InviteModal from "../components/room/InviteModal";
import SpotifyWarning from "../components/room/SpotifyWarning";
import { useApp } from "../context/AppContext";
import { useSpotifyPlayback } from "../hooks/useSpotifyPlayback";
import api from "../api/client";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "../context/AuthContext";
import {
  inviteUserToRoom,
  regenerateRoomCode,
  fetchRoomBySlug,
} from "../api/rooms";

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
    loadingTracks,
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
    handleAddTrack,
    handleVote,
    handleSetNowPlaying,
    handleClearNowPlaying,
    handleChangeTheme,
    handleTrackEnded,
    handleSkipTrack,
    handleDeleteTrack,
    handleReorderTrack,
    handleReorderTracks,
  } = roomDetail;

  const { user } = useAuth();
  const isRoomCreator = user && roomCreatedBy === user.uid;

  const {
    messages,
    loading: chatLoading,
    sending: chatSending,
    handleSendText,
    handleSendImage,
    handleSendGif,
    handleSendVoice,
  } = roomChat;

  const {
    spotify,
    playSpotifyTrack,
    setOnTrackEnded,
    stopSpotify,
    refreshSpotifyConnection,
    connectSpotify,
  } = useApp();
  const { isReady: spotifyReady, isConnecting: spotifyConnecting } = spotify;

  // Store YouTube stop function
  const youtubeStopRef = useRef<(() => void) | null>(null);

  const handleYouTubePlayerReady = useCallback(
    (controls: { stop: () => void }) => {
      youtubeStopRef.current = controls.stop;
    },
    []
  );

  // Function to stop the current player based on what's playing
  const stopCurrentPlayer = useCallback(
    (newTrackUrl: string) => {
      const isNewTrackSpotify = newTrackUrl?.includes("spotify.com");
      const isNewTrackYouTube =
        newTrackUrl?.includes("youtube.com") ||
        newTrackUrl?.includes("youtu.be");

      // If switching to YouTube, stop Spotify
      if (isNewTrackYouTube && stopSpotify) {
        stopSpotify();
      }

      // If switching to Spotify, stop YouTube
      if (isNewTrackSpotify && youtubeStopRef.current) {
        youtubeStopRef.current();
      }
    },
    [stopSpotify]
  );

  // Wrapper for handleSetNowPlaying that stops the other player first
  const handleSetNowPlayingWithStop = useCallback(
    (trackId: string) => {
      // Find the track to get its URL
      const track = tracks.find((t) => t.id === trackId);
      if (track?.url) {
        stopCurrentPlayer(track.url);
      }
      handleSetNowPlaying(trackId);
    },
    [tracks, stopCurrentPlayer, handleSetNowPlaying]
  );

  // Set up Spotify track end callback
  useEffect(() => {
    if (setOnTrackEnded && handleTrackEnded) {
      setOnTrackEnded(handleTrackEnded);
    }
    return () => {
      if (setOnTrackEnded) {
        setOnTrackEnded(null);
      }
    };
  }, [setOnTrackEnded, handleTrackEnded]);

  // Use Spotify playback hook
  useSpotifyPlayback({
    nowPlayingTrack,
    nowPlayingStartedAt,
    spotifyReady,
    playSpotifyTrack,
  });

  // Cleanup: Stop playback when user leaves the room or switches rooms
  useEffect(() => {
    // This will run when component unmounts or roomId changes
    return () => {
      // Stop Spotify playback
      if (stopSpotify) {
        stopSpotify().catch((e) => {
          console.error("Error stopping Spotify on cleanup:", e);
        });
      }
      // Stop YouTube playback
      if (youtubeStopRef.current) {
        try {
          youtubeStopRef.current();
        } catch (e) {
          console.error("Error stopping YouTube on cleanup:", e);
        }
      }
    };
  }, [roomId, stopSpotify]); // Re-run cleanup when roomId changes or component unmounts

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

  async function handleConnectSpotify() {
    try {
      if (Platform.OS === "web") {
        await connectSpotify();
      } else {
        const res = await api.post("/spotify/login-url");
        const { url } = res.data;
        await WebBrowser.openBrowserAsync(url);
        // On native, refresh connection after browser closes
        // Note: This is a best-effort approach since we can't reliably detect when browser closes
        setTimeout(() => {
          refreshSpotifyConnection();
        }, 2000);
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
            <RoomHeader
              roomName={roomName}
              socketConnected={socketConnected}
              roomUsers={roomUsers}
              spotifyReady={spotifyReady}
              isRoomCreator={isRoomCreator}
              onInvite={() => setShowInviteModal(true)}
              onConnectSpotify={handleConnectSpotify}
              headerAnimStyle={headerAnimStyle}
            />

            <RoomThemePicker value={roomTheme} onChange={handleChangeTheme} />

            {isRoomCreator && (
              <RoomCodeCard
                roomCode={roomCode}
                regenerating={regenerating}
                onRegenerate={handleRegenerateCode}
                onCopy={handleCopyRoomCode}
              />
            )}

            <SpotifyWarning
              visible={
                !!(
                  nowPlayingTrack &&
                  nowPlayingTrack.provider === "spotify" &&
                  !spotifyReady &&
                  Platform.OS === "web"
                )
              }
              onConnect={handleConnectSpotify}
              connecting={spotifyConnecting}
            />
            <NowPlayingBar
              track={nowPlayingTrack}
              meta={nowPlayingMeta}
              roomTheme={roomTheme}
              settingNowPlayingFor={settingNowPlayingFor}
              onClear={async () => {
                // Stop current playback before clearing
                if (
                  nowPlayingTrack?.provider === "spotify" ||
                  (nowPlayingTrack?.url &&
                    nowPlayingTrack.url.includes("spotify.com"))
                ) {
                  if (stopSpotify) {
                    await stopSpotify();
                  }
                } else if (
                  nowPlayingTrack?.provider === "youtube" ||
                  (nowPlayingTrack?.url &&
                    (nowPlayingTrack.url.includes("youtube.com") ||
                      nowPlayingTrack.url.includes("youtu.be")))
                ) {
                  if (youtubeStopRef.current) {
                    youtubeStopRef.current();
                  }
                }
                handleClearNowPlaying();
              }}
              onSkip={handleSkipTrack}
            />

            {nowPlayingTrack &&
              (nowPlayingTrack.provider === "youtube" ||
                (nowPlayingTrack.url &&
                  (nowPlayingTrack.url.includes("youtube.com") ||
                    nowPlayingTrack.url.includes("youtu.be")))) && (
                <WebNowPlayingPlayer
                  url={nowPlayingTrack.url}
                  startedAt={nowPlayingStartedAt}
                  onTrackEnded={handleTrackEnded}
                  onPlayerReady={handleYouTubePlayerReady}
                />
              )}

            <AddTrackCard adding={adding} onAdd={handleAddTrack} />

            <RoomChat
              messages={messages}
              loading={chatLoading}
              sending={chatSending}
              onSendText={handleSendText}
              onSendImage={handleSendImage}
              onSendGif={handleSendGif}
              onSendVoice={handleSendVoice}
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
                onSetNowPlaying={handleSetNowPlayingWithStop}
                onDeleteTrack={handleDeleteTrack}
                onReorderTrack={handleReorderTrack}
                onReorderTracks={handleReorderTracks}
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

      <InviteModal
        visible={showInviteModal}
        email={inviteEmail}
        inviting={inviting}
        onEmailChange={setInviteEmail}
        onInvite={handleInviteUser}
        onClose={() => {
          setShowInviteModal(false);
          setInviteEmail("");
        }}
      />
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
});
