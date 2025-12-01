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



type Props = NativeStackScreenProps<RootStackParamList, "RoomDetail">;

export default function RoomDetailScreen({ route }: Props) {
  const { roomId, roomName } = route.params;

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
    setUrl,
    setNote,
    handleAddTrack,
    handleVote,
    handleSelectGif,
    handleSetNowPlaying,
    handleClearNowPlaying,
    handleChangeTheme,
  } = useRoomDetail(roomId);

  const {
    messages,
    loading: chatLoading,
    sending: chatSending,
    handleSend,
  } = useRoomChat(roomId);

  const { isReady: spotifyReady, playSpotifyTrack } = useSpotifyPlayer();


  const headerAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView | null>(null);
  const [tracksSectionY, setTracksSectionY] = useState(0);

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
    if (Platform.OS !== "web") return;
    if (!nowPlayingTrack) return;
    if (
      nowPlayingTrack.provider !== "spotify" &&
      !(nowPlayingTrack.url && nowPlayingTrack.url.includes("spotify.com"))
    ) {
      return;
    }

    if (!nowPlayingStartedAt) {
      // fallback: start from 0 if we don't have a timestamp
      playSpotifyTrack(nowPlayingTrack.url, 0);
      return;
    }

    const offsetSeconds = Math.max(
      0,
      (Date.now() - nowPlayingStartedAt) / 1000
    );
    playSpotifyTrack(nowPlayingTrack.url, offsetSeconds);
  }, [nowPlayingTrack?.id, nowPlayingStartedAt, spotifyReady]);

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
                <PresenceAvatars count={roomUsers} />
                <Text onPress={handleConnectSpotify}>
                  <Text>Connect Spotify</Text>
                </Text>
              </View>

            </Animated.View>

            <RoomThemePicker value={roomTheme} onChange={handleChangeTheme} />

            <NowPlayingBar
              track={nowPlayingTrack}
              meta={nowPlayingMeta}
              roomTheme={roomTheme}
              settingNowPlayingFor={settingNowPlayingFor}
              onClear={handleClearNowPlaying}
            />

            <WebNowPlayingPlayer
              url={nowPlayingTrack?.url}
              startedAt={nowPlayingStartedAt}
            />

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

            <View
              onLayout={(e) =>
                setTracksSectionY(e.nativeEvent.layout.y)
              }
            >
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
});
