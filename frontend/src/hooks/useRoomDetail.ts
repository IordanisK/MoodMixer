import { useEffect, useState } from "react";
import {
  Track,
  Room,
  MoodItem,
  fetchTracks,
  addTrack,
  voteTrack,
  fetchMoodItems,
  addMoodItem,
  fetchRoom,
  setNowPlaying,
  advanceToNextTrack,
  deleteTrack,
  reorderTrack,
  reorderAllTracks,
} from "../api/rooms";
import {
  TrackMetadata,
  fetchTrackMetadata,
} from "../api/metadata";
import {
  getSocket,
  leaveRoom,
  subscribeToRoomEvents,
} from "../sockets/socket";
import { RoomThemeId } from "../theme";
import { updateRoomTheme } from "../api/rooms";

export function useRoomDetail(roomId: string) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [moodItems, setMoodItems] = useState<MoodItem[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [loadingMood, setLoadingMood] = useState(false);

  const [adding, setAdding] = useState(false);

  const [nowPlayingId, setNowPlayingId] = useState<string | null>(null);
  const [settingNowPlayingFor, setSettingNowPlayingFor] = useState<
    string | null
  >(null);
  const [nowPlayingStartedAt, setNowPlayingStartedAt] = useState<number | null>(null);

  const [socketConnected, setSocketConnected] = useState(false);
  const [roomUsers, setRoomUsers] = useState(1);

  const [trackMeta, setTrackMeta] = useState<Record<string, TrackMetadata>>({});
  const [roomTheme, setRoomTheme] = useState<RoomThemeId>("synthwave");
  const [roomCreatedBy, setRoomCreatedBy] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);



  // --------- loaders ---------

  const loadTracks = async () => {
    if (!roomId) return;
    try {
      setLoadingTracks(true);
      const data = await fetchTracks(roomId);
      setTracks(data);
    } catch (e) {
      console.log("Error loading tracks", e);
    } finally {
      setLoadingTracks(false);
    }
  };

  const loadMood = async () => {
    if (!roomId) return;
    try {
      setLoadingMood(true);
      const data = await fetchMoodItems(roomId);
      setMoodItems(data);
    } catch (e) {
      console.log("Error loading mood items", e);
    } finally {
      setLoadingMood(false);
    }
  };

const loadRoom = async () => {
  if (!roomId) return;
  try {
    const room: Room = await fetchRoom(roomId);
    setNowPlayingId(room.nowPlayingTrackId ?? null);
    setNowPlayingStartedAt(room.nowPlayingStartedAt ?? null);
    setRoomTheme((room.theme as RoomThemeId) || "synthwave");
    setRoomCreatedBy(room.createdBy || null);
    setRoomCode(room.roomCode || null);
  } catch (e: any) {
    console.log("Error loading room", e);
    // If access denied, throw error to be handled by component
    if (e.response?.status === 403) {
      throw new Error("You don't have access to this room");
    }
  }
};

  // --------- actions ---------

  const handleAddTrack = async (url: string, note: string) => {
    if (!url.trim()) return;
    try {
      setAdding(true);
      const newTrack = await addTrack(roomId, { url, note });
      // Add to bottom of list (queue order)
      setTracks((prev) => [...prev, newTrack]);
    } catch (e) {
      console.log("Error adding track", e);
    } finally {
      setAdding(false);
    }
  };

  const handleVote = async (trackId: string, value: 1 | -1) => {
    try {
      const updated = await voteTrack(roomId, trackId, value);
      setTracks((prev) => prev.map((t) => (t.id === trackId ? updated : t)));
    } catch (e) {
      console.log("Error voting", e);
    }
  };

  const handleSelectGif = async (gifUrl: string) => {
    try {
      const item = await addMoodItem(roomId, { type: "gif", url: gifUrl });
      setMoodItems((prev) => [item, ...prev]);
    } catch (e) {
      console.log("Error adding mood item", e);
    }
  };

  const handleSetNowPlaying = async (trackId: string) => {
    try {
      setSettingNowPlayingFor(trackId);
      const updatedRoom = await setNowPlaying(roomId, trackId);
      setNowPlayingId(updatedRoom.nowPlayingTrackId ?? null);
    } catch (e) {
      console.log("Error setting now playing", e);
    } finally {
      setSettingNowPlayingFor(null);
    }
  };

  const handleClearNowPlaying = async () => {
    try {
      setSettingNowPlayingFor("clear");
      const updatedRoom = await setNowPlaying(roomId, null);
      setNowPlayingId(updatedRoom.nowPlayingTrackId ?? null);
    } catch (e) {
      console.log("Error clearing now playing", e);
    } finally {
      setSettingNowPlayingFor(null);
    }
  };

  const handleTrackEnded = async () => {
    console.log("🎵 Track ended, advancing to next track...");
    try {
      const result = await advanceToNextTrack(roomId);
      console.log("Advanced to next track:", result.nextTrackId);
      if (result.nextTrackId) {
        setNowPlayingId(result.nextTrackId);
        if (result.room?.nowPlayingStartedAt) {
          setNowPlayingStartedAt(result.room.nowPlayingStartedAt);
        }
      } else {
        setNowPlayingId(null);
        setNowPlayingStartedAt(null);
        console.log("Queue ended - no more tracks");
      }
    } catch (e) {
      console.log("Error advancing to next track", e);
    }
  };

  const handleSkipTrack = async () => {
    console.log("⏭️ Skipping track...");
    await handleTrackEnded();
  };

  const handleDeleteTrack = async (trackId: string) => {
    try {
      await deleteTrack(roomId, trackId);
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
    } catch (e) {
      console.log("Error deleting track", e);
    }
  };

  const handleReorderTrack = async (trackId: string, direction: "up" | "down") => {
    try {
      const result = await reorderTrack(roomId, trackId, direction);
      if (result.tracks) {
        setTracks(result.tracks);
      }
    } catch (e) {
      console.log("Error reordering track", e);
    }
  };

  const handleReorderTracks = async (newTracks: Track[]) => {
    // Optimistically update local state
    setTracks(newTracks);
    
    try {
      const trackIds = newTracks.map((t) => t.id);
      const result = await reorderAllTracks(roomId, trackIds);
      if (result.tracks) {
        setTracks(result.tracks);
      }
    } catch (e) {
      console.log("Error reordering tracks", e);
      // Revert to original order on error
      loadTracks();
    }
  };

  // --------- socket + initial load ---------

  useEffect(() => {
    if (!roomId) return;

    let unsubscribeEvents: (() => void) | null = null;
    let socketCleanup: (() => void) | null = null;

    (async () => {
      try {
        await Promise.all([loadTracks(), loadMood(), loadRoom()]);

        const socket = await getSocket();

        setSocketConnected(socket.connected);
        const handleConnect = () => setSocketConnected(true);
        const handleDisconnect = () => setSocketConnected(false);

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);

        socket.emit("join-room", roomId);

        socketCleanup = () => {
          socket.emit("leave-room", roomId);
          socket.off("connect", handleConnect);
          socket.off("disconnect", handleDisconnect);
        };

        unsubscribeEvents = subscribeToRoomEvents(roomId, {
          onTrackAdded: (track) => {
            setTracks((prev) => {
              if (prev.find((t) => t.id === track.id)) return prev;
              // Add to bottom of list (queue order)
              return [...prev, track];
            });
          },
          onTrackUpdated: (track) => {
            setTracks((prev) =>
              prev.map((t) => (t.id === track.id ? track : t))
            );
          },
          onTrackRemoved: (trackId) => {
            setTracks((prev) => prev.filter((t) => t.id !== trackId));
          },
          onTracksReordered: (tracks) => {
            setTracks(tracks);
          },
          onMoodItemAdded: (item) => {
            setMoodItems((prev) => {
              if (prev.find((m) => m.id === item.id)) return prev;
              return [item, ...prev];
            });
          },
          onNowPlayingChanged: (trackId) => {
            console.log("Now playing changed via socket:", trackId);
            setNowPlayingId(trackId);
          },
          onNowPlayingState: (trackId, startedAt) => {
            console.log("Now playing state via socket:", trackId, "startedAt:", startedAt);
            setNowPlayingId(trackId);
            setNowPlayingStartedAt(startedAt ?? null);
          },
          onRoomUsersChanged: (count) => {
            setRoomUsers(count);
          },
          onRoomThemeChanged: (theme) => {
            setRoomTheme(theme);
          },
        });
      } catch (err) {
        console.log("Error joining room / socket", err);
      }
    })();

    return () => {
      if (unsubscribeEvents) unsubscribeEvents();
      if (socketCleanup) socketCleanup();
      if (roomId) leaveRoom(roomId);
    };
  }, [roomId]);

  // --------- metadata for tracks ---------

  useEffect(() => {
    tracks.forEach((t) => {
      if (!t.url) return;
      if (trackMeta[t.id]) return;

      fetchTrackMetadata(t.url)
        .then((meta) => {
          setTrackMeta((prev) => ({ ...prev, [t.id]: meta }));
        })
        .catch((err) => {
          console.log("Metadata fetch error", err);
        });
    });
  }, [tracks, trackMeta]);

  const nowPlayingTrack: Track | undefined =
    nowPlayingId ? tracks.find((t) => t.id === nowPlayingId) : undefined;

  const nowPlayingMeta: TrackMetadata | undefined =
    nowPlayingTrack ? trackMeta[nowPlayingTrack.id] : undefined;

  const handleChangeTheme = async (theme: RoomThemeId) => {
  try {
    setRoomTheme(theme); // optimistic
    await updateRoomTheme(roomId, theme);
  } catch (e) {
    console.log("Error changing theme", e);
  }
};

  return {
    tracks,
    moodItems,
    loadingTracks,
    loadingMood,
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
    handleSelectGif,
    handleSetNowPlaying,
    handleClearNowPlaying,
    handleChangeTheme,
    handleTrackEnded,
    handleSkipTrack,
    handleDeleteTrack,
    handleReorderTrack,
    handleReorderTracks,
  };
}
