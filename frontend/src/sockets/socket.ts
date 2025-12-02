// src/sockets/socket.ts
import { io, Socket } from "socket.io-client";
import { Platform } from "react-native";
import { auth } from "../firebase";
import { RoomThemeId } from "../theme";
import { ChatMessage } from "../api/chat";

let socket: Socket | null = null;

// Use environment variable for production, fallback to localhost for development
const getBaseURL = () => {
  // Check for environment variable (set during build)
  if (typeof process !== "undefined" && process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Development URLs
  if (Platform.OS === "android") {
    return "http://10.0.2.2:4000";
  }

  return "http://127.0.0.1:4000";
};

const baseURL = getBaseURL();

export async function getSocket(): Promise<Socket> {
  if (socket && socket.connected) return socket;

  const user = auth.currentUser;
  if (!user) throw new Error("No user for socket");

  const token = await user.getIdToken();

  return new Promise((resolve, reject) => {
    const s = io(baseURL, {
      auth: { token },
    });

    s.on("connect", () => {
      socket = s;
      resolve(s);
    });

    s.on("connect_error", (err) => {
      reject(err);
    });
  });
}

export async function joinRoom(roomId: string) {
  const s = await getSocket();
  s.emit("join-room", roomId);
}

export function leaveRoom(roomId: string) {
  if (!socket) return;
  socket.emit("leave-room", roomId);
}

type Handlers = {
  onTrackAdded?: (track: any) => void;
  onTrackUpdated?: (track: any) => void;
  onTrackRemoved?: (trackId: string) => void;
  onTracksReordered?: (tracks: any[]) => void;
  onMoodItemAdded?: (item: any) => void;
  onNowPlayingChanged?: (trackId: string | null) => void;
  onNowPlayingState?: (
    trackId: string | null,
    startedAt?: number | null
  ) => void;
  onRoomUsersChanged?: (count: number) => void;
  onRoomThemeChanged?: (theme: RoomThemeId) => void;
  onChatMessageAdded?: (message: ChatMessage) => void;
  onTestUserJoined?: (payload: { roomId: string; userId: string; userName: string; timestamp: number }) => void;
};

export function subscribeToRoomEvents(roomId: string, handlers: Handlers) {
  if (!socket) return () => {};

  const {
    onTrackAdded,
    onTrackUpdated,
    onTrackRemoved,
    onTracksReordered,
    onMoodItemAdded,
    onNowPlayingChanged,
    onNowPlayingState,
    onRoomUsersChanged,
    onRoomThemeChanged,
    onChatMessageAdded,
    onTestUserJoined,
  } = handlers;

  // Store handlers for proper cleanup
  const handlerRefs: Array<{
    event: string;
    handler: (...args: any[]) => void;
  }> = [];

  if (onTrackAdded) {
    const handler = (payload: any) => {
      if (payload.roomId === roomId) {
        onTrackAdded(payload.track);
      }
    };
    socket.on("track-added", handler);
    handlerRefs.push({ event: "track-added", handler });
  }

  if (onTrackUpdated) {
    const handler = (payload: any) => {
      if (payload.roomId === roomId) {
        onTrackUpdated(payload.track);
      }
    };
    socket.on("track-updated", handler);
    handlerRefs.push({ event: "track-updated", handler });
  }

  if (onTrackRemoved) {
    const handler = (payload: any) => {
      if (payload.roomId === roomId) {
        onTrackRemoved(payload.trackId);
      }
    };
    socket.on("track-removed", handler);
    handlerRefs.push({ event: "track-removed", handler });
  }

  if (onTracksReordered) {
    const handler = (payload: any) => {
      if (payload.roomId === roomId) {
        onTracksReordered(payload.tracks);
      }
    };
    socket.on("tracks-reordered", handler);
    handlerRefs.push({ event: "tracks-reordered", handler });
  }

  if (onMoodItemAdded) {
    const handler = (payload: any) => {
      if (payload.roomId === roomId) {
        onMoodItemAdded(payload.item);
      }
    };
    socket.on("mood-item-added", handler);
    handlerRefs.push({ event: "mood-item-added", handler });
  }

  if (onNowPlayingChanged) {
    const handler = (payload: any) => {
      const trackId =
        typeof payload === "string" || payload === null
          ? payload
          : payload.roomId === roomId
          ? payload.trackId
          : null;
      if (trackId !== undefined) {
        onNowPlayingChanged(trackId);
      }
    };
    socket.on("now-playing-changed", handler);
    handlerRefs.push({ event: "now-playing-changed", handler });
  }

  if (onRoomUsersChanged) {
    const handler = (payload: any) => {
      if (payload.roomId === roomId) {
        onRoomUsersChanged(payload.count);
      }
    };
    socket.on("room-users", handler);
    handlerRefs.push({ event: "room-users", handler });
  }

  if (onRoomThemeChanged) {
    const handler = (payload: any) => {
      if (payload.roomId === roomId) {
        onRoomThemeChanged(payload.theme);
      }
    };
    socket.on("room-theme-changed", handler);
    handlerRefs.push({ event: "room-theme-changed", handler });
  }

  if (onChatMessageAdded) {
    const handler = (payload: any) => {
      if (payload.roomId === roomId) {
        onChatMessageAdded(payload.message);
      }
    };
    socket.on("chat-message-added", handler);
    handlerRefs.push({ event: "chat-message-added", handler });
  }

  if (onNowPlayingState) {
    const handler = (payload: any) => {
      const trackId = payload?.trackId ?? null;
      const startedAt = payload?.startedAt ?? null;
      onNowPlayingState(trackId, startedAt);
    };
    socket.on("now-playing-state", handler);
    handlerRefs.push({ event: "now-playing-state", handler });
  }

  if (onTestUserJoined) {
    const handler = (payload: any) => {
      if (payload.roomId === roomId) {
        onTestUserJoined(payload);
      }
    };
    socket.on("test-user-joined", handler);
    handlerRefs.push({ event: "test-user-joined", handler });
  }

  // unsubscribe function
  return () => {
    if (!socket) return;
    const currentSocket = socket;
    handlerRefs.forEach(({ event, handler }) => {
      currentSocket.off(event, handler);
    });
  };
}
