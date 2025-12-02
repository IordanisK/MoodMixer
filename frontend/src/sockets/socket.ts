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
      console.log("Socket connected", s.id);
      resolve(s);
    });

    s.on("connect_error", (err) => {
      console.log("Socket connect error", err);
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
  onNowPlayingState?: (trackId: string | null, startedAt?: number | null) => void;
  onRoomUsersChanged?: (count: number) => void; 
  onRoomThemeChanged?: (theme: RoomThemeId) => void;
  onChatMessageAdded?: (message: ChatMessage) => void;
};

export function subscribeToRoomEvents(roomId: string, handlers: Handlers) {
  if (!socket) return () => {};

  const { onTrackAdded, onTrackUpdated, onTrackRemoved, onTracksReordered, onMoodItemAdded, onNowPlayingChanged, onNowPlayingState, onRoomUsersChanged, onRoomThemeChanged, onChatMessageAdded, } =
    handlers;

  if (onTrackAdded) {
    socket.on("track-added", (payload: any) => {
      if (payload.roomId === roomId) {
        onTrackAdded(payload.track);
      }
    });
  }

  if (onTrackUpdated) {
    socket.on("track-updated", (payload: any) => {
      if (payload.roomId === roomId) {
        onTrackUpdated(payload.track);
      }
    });
  }

  if (onTrackRemoved) {
    socket.on("track-removed", (payload: any) => {
      if (payload.roomId === roomId) {
        onTrackRemoved(payload.trackId);
      }
    });
  }

  if (onTracksReordered) {
    socket.on("tracks-reordered", (payload: any) => {
      if (payload.roomId === roomId) {
        onTracksReordered(payload.tracks);
      }
    });
  }

  if (onMoodItemAdded) {
    socket.on("mood-item-added", (payload: any) => {
      if (payload.roomId === roomId) {
        onMoodItemAdded(payload.item);
      }
    });
  }

  if (onNowPlayingChanged) {
    socket.on("now-playing-changed", (trackId: string | null) => {
      // Event is already scoped to the room by backend, so we can call directly
      onNowPlayingChanged(trackId);
    });
  }

  if (onRoomUsersChanged) {
    socket.on("room-users", (payload: any) => {
      if (payload.roomId === roomId) {
        onRoomUsersChanged(payload.count);
      }
    });
  }

  if (onRoomThemeChanged) {
    socket.on("room-theme-changed", (payload: any) => {
      if (payload.roomId === roomId) {
        onRoomThemeChanged(payload.theme);
      }
    });
  }

  if (onChatMessageAdded) {
    socket.on("chat-message-added", (payload: any) => {
      if (payload.roomId === roomId) {
        onChatMessageAdded(payload.message);
      }
    });
  }

  if (onNowPlayingState) {
    socket.on("now-playing-state", (payload: any) => {
      // Event is already scoped to the room by backend
      const trackId = payload?.trackId ?? null;
      const startedAt = payload?.startedAt ?? null;
      onNowPlayingState(trackId, startedAt);
    });
  }


  // unsubscribe function
  return () => {
    if (!socket) return;
    if (onTrackAdded) socket.off("track-added");
    if (onTrackUpdated) socket.off("track-updated");
    if (onTrackRemoved) socket.off("track-removed");
    if (onTracksReordered) socket.off("tracks-reordered");
    if (onMoodItemAdded) socket.off("mood-item-added");
    if (onNowPlayingChanged) socket.off("now-playing-changed");
    if (onNowPlayingState) socket.off("now-playing-state");
    if (onRoomUsersChanged) socket.off("room-users");
    if (onRoomThemeChanged) socket.off("room-theme-changed");
    if (onChatMessageAdded) socket.off("chat-message-added");
  };
}
