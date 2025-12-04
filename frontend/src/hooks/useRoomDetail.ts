import { useEffect, useState } from "react";
import {
  Track,
  Room,
  fetchTracks,
  addTrack,
  voteTrack,
  fetchRoom,
  setNowPlaying,
  advanceToNextTrack,
  deleteTrack,
  reorderTrack,
  reorderAllTracks,
} from "../api/rooms";
import { TrackMetadata, fetchTrackMetadata } from "../api/metadata";
import { getSocket, leaveRoom, subscribeToRoomEvents } from "../sockets/socket";
import { RoomThemeId } from "../theme";
import { updateRoomTheme } from "../api/rooms";

export function useRoomDetail(roomId: string) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  const [adding, setAdding] = useState(false);

  const [nowPlayingId, setNowPlayingId] = useState<string | null>(null);
  const [settingNowPlayingFor, setSettingNowPlayingFor] = useState<
    string | null
  >(null);
  const [nowPlayingStartedAt, setNowPlayingStartedAt] = useState<number | null>(
    null
  );

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
      // Don't optimistically update - let the socket event handle it
      // This ensures all users see the track at the same time
      await addTrack(roomId, { url, note });
    } catch (e) {
      console.log("Error adding track", e);
    } finally {
      setAdding(false);
    }
  };

  const handleVote = async (trackId: string, value: 1 | -1) => {
    try {
      // Don't optimistically update - let the socket event handle it
      // This ensures all users see the vote update at the same time
      await voteTrack(roomId, trackId, value);
    } catch (e) {
      console.log("Error voting", e);
    }
  };

  const handleSetNowPlaying = async (trackId: string) => {
    try {
      setSettingNowPlayingFor(trackId);
      // Don't optimistically update - let the socket event handle it
      // This ensures all users see the now playing change at the same time
      await setNowPlaying(roomId, trackId);
    } catch (e) {
      console.log("Error setting now playing", e);
    } finally {
      setSettingNowPlayingFor(null);
    }
  };

  const handleClearNowPlaying = async () => {
    try {
      setSettingNowPlayingFor("clear");
      // Don't optimistically update - let the socket event handle it
      // This ensures all users see the clear at the same time
      await setNowPlaying(roomId, null);
    } catch (e) {
      console.log("Error clearing now playing", e);
    } finally {
      setSettingNowPlayingFor(null);
    }
  };

  const handleTrackEnded = async () => {
    try {
      const result = await advanceToNextTrack(roomId);
      if (result.nextTrackId) {
        setNowPlayingId(result.nextTrackId);
        if (result.room?.nowPlayingStartedAt) {
          setNowPlayingStartedAt(result.room.nowPlayingStartedAt);
        }
      } else {
        setNowPlayingId(null);
        setNowPlayingStartedAt(null);
      }
    } catch (e) {
      console.error("Error advancing to next track", e);
    }
  };

  const handleSkipTrack = async () => {
    await handleTrackEnded();
  };

  const handleDeleteTrack = async (trackId: string) => {
    try {
      // Don't optimistically update - let the socket event handle it
      // This ensures all users see the deletion at the same time
      await deleteTrack(roomId, trackId);
    } catch (e) {
      console.log("Error deleting track", e);
    }
  };

  const handleReorderTrack = async (
    trackId: string,
    direction: "up" | "down"
  ) => {
    try {
      // Don't optimistically update - let the socket event handle it
      // This ensures all users see the reorder at the same time
      await reorderTrack(roomId, trackId, direction);
    } catch (e) {
      console.log("Error reordering track", e);
    }
  };

  const handleReorderTracks = async (newTracks: Track[]) => {
    try {
      // Don't optimistically update - let the socket event handle it
      // This ensures all users see the reorder at the same time
      const trackIds = newTracks.map((t) => t.id);
      await reorderAllTracks(roomId, trackIds);
    } catch (e) {
      console.log("Error reordering tracks", e);
      // Reload tracks on error to get the correct state
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
        await Promise.all([loadTracks(), loadRoom()]);

        const socket = await getSocket();

        setSocketConnected(socket.connected);
        
        // Handler for when socket connects (including reconnections)
        const handleConnect = async () => {
          setSocketConnected(true);
          
          // Rejoin the room on reconnect to ensure we're still in the room
          // This is important because socket.io rooms are cleared on disconnect
          if (socket.connected) {
            socket.emit("join-room", roomId);
            
            // Reload state to catch up on any missed events while disconnected
            try {
              await Promise.all([loadTracks(), loadRoom()]);
            } catch (err) {
              console.error("Error reloading room state after reconnect:", err);
            }
          }
        };
        
        const handleDisconnect = () => {
          setSocketConnected(false);
        };

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);

        // Subscribe to events BEFORE joining the room to ensure we receive the initial state
        // Pass the socket instance explicitly to avoid race conditions
        unsubscribeEvents = subscribeToRoomEvents(roomId, {
          onTrackAdded: (track) => {
            setTracks((prev) => {
              if (prev.find((t) => t.id === track.id)) {
                return prev;
              }
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
          onNowPlayingChanged: (trackId) => {
            setNowPlayingId(trackId);
          },
          onNowPlayingState: (trackId, startedAt) => {
            setNowPlayingId(trackId);
            setNowPlayingStartedAt(startedAt ?? null);
          },
          onRoomUsersChanged: (count) => {
            setRoomUsers(count);
          },
          onRoomThemeChanged: (theme) => {
            setRoomTheme(theme);
          },
        }, socket);

        // Join the room after subscribing to events
        if (socket.connected) {
          socket.emit("join-room", roomId);
        } else {
          socket.once("connect", () => {
            socket.emit("join-room", roomId);
          });
        }

        socketCleanup = () => {
          socket.emit("leave-room", roomId);
          socket.off("connect", handleConnect);
          socket.off("disconnect", handleDisconnect);
        };
      } catch (err) {
        console.error("Error joining room / socket", err);
      }
    })();

    return () => {
      // Unsubscribe from all event listeners first
      if (unsubscribeEvents) unsubscribeEvents();
      // Leave the room and clean up socket handlers
      if (socketCleanup) socketCleanup();
      // Note: We don't call leaveRoom() here because socketCleanup already handles it
      // and we want to use the captured socket instance, not the module-level one
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

  const nowPlayingTrack: Track | undefined = nowPlayingId
    ? tracks.find((t) => t.id === nowPlayingId)
    : undefined;

  const nowPlayingMeta: TrackMetadata | undefined = nowPlayingTrack
    ? trackMeta[nowPlayingTrack.id]
    : undefined;

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
  };
}
