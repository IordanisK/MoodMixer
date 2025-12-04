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

  // Determine if we're in local development
  const isLocal = (() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const hostname = window.location.hostname;
      return (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0"
      );
    }
    // For React Native, assume local development unless explicitly set
    return true;
  })();

  // Development URLs
  if (Platform.OS === "android") {
    return "http://10.0.2.2:4000";
  }

  return isLocal
    ? "http://127.0.0.1:4000"
    : "https://moodmixer-backend-dxbpzs77wa-uc.a.run.app";
};

const baseURL = getBaseURL();

export async function getSocket(): Promise<Socket> {
  // If socket exists and is connected, return it
  if (socket && socket.connected) return socket;

  // If socket exists but is disconnected, reuse it (it will reconnect automatically)
  if (socket && !socket.connected) {
    // Wait a bit to see if it connects, or return it anyway (reconnection will happen)
    const existingSocket = socket; // Capture for closure
    return new Promise((resolve) => {
      // Set up a one-time listener for when it reconnects
      const onConnect = () => {
        existingSocket.off("connect", onConnect);
        resolve(existingSocket);
      };
      existingSocket.once("connect", onConnect);
      // Also resolve immediately - the socket will reconnect automatically
      // This allows the caller to proceed while reconnection happens in background
      setTimeout(() => resolve(existingSocket), 100);
    });
  }

  const user = auth.currentUser;
  if (!user) throw new Error("No user for socket");

  const token = await user.getIdToken();

  return new Promise((resolve, reject) => {
    const s = io(baseURL, {
      auth: { token },
      transports: ["websocket", "polling"], // Try websocket first, fallback to polling
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity, // Keep trying to reconnect indefinitely
      timeout: 20000, // Connection timeout
      forceNew: false, // Reuse existing connection if available
      // Additional options for better connection stability
      upgrade: true, // Allow transport upgrades (polling -> websocket)
      rememberUpgrade: true, // Remember transport preference
    });

    // Track if this is the initial connection
    let isInitialConnection = true;
    let hasResolved = false;

    // Store handlers so we can clean them up if needed (though they persist for socket lifetime)
    const connectHandler = async () => {
      // If reconnecting (not initial connection), refresh token
      // Note: Socket.io doesn't support updating auth after connection, but we refresh
      // the token here so it's ready for the next reconnection if needed
      if (!isInitialConnection) {
        try {
          const currentUser = auth.currentUser;
          if (currentUser) {
            // Refresh token for future use (token is cached by Firebase)
            await currentUser.getIdToken(true);
          }
        } catch (err) {
          console.error("Error refreshing token after reconnect:", err);
        }
      }
      
      socket = s;
      if (isInitialConnection && !hasResolved) {
        isInitialConnection = false;
        hasResolved = true;
        resolve(s);
      }
    };

    s.on("connect", connectHandler);

    s.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err);
      // Only reject on initial connection attempt
      if (isInitialConnection && !hasResolved) {
        isInitialConnection = false;
        hasResolved = true;
        reject(err);
      }
    });

    s.on("disconnect", (reason) => {
      isInitialConnection = false;
      // If disconnected due to server closing or transport close, the connection is definitely dead
      // Socket.io will automatically try to reconnect, but we should be aware
      if (reason === "io server disconnect" || reason === "transport close") {
        // Connection was closed by server or transport failed
        // Reconnection will happen automatically
      }
    });

    s.on("reconnect", () => {
      isInitialConnection = false;
    });

    s.on("reconnect_error", (error) => {
      console.error("❌ Socket reconnection error:", error);
    });

    // Note: reconnect_failed event won't fire with reconnectionAttempts: Infinity
    // so we don't need to handle it
  });
}

export function leaveRoom(roomId: string) {
  if (!socket) {
    return;
  }
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
};

export function subscribeToRoomEvents(
  roomId: string,
  handlers: Handlers,
  socketInstance?: Socket
) {
  // Use provided socket instance or fall back to module-level socket
  const s = socketInstance || socket;
  if (!s) {
    console.warn("subscribeToRoomEvents: No socket available");
    return () => {};
  }

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
    s.on("track-added", handler);
    handlerRefs.push({ event: "track-added", handler });
  }

  if (onTrackUpdated) {
    const handler = (payload: any) => {
      if (payload.roomId === roomId) {
        onTrackUpdated(payload.track);
      }
    };
    s.on("track-updated", handler);
    handlerRefs.push({ event: "track-updated", handler });
  }

  if (onTrackRemoved) {
    const handler = (payload: any) => {
      if (payload.roomId === roomId) {
        onTrackRemoved(payload.trackId);
      }
    };
    s.on("track-removed", handler);
    handlerRefs.push({ event: "track-removed", handler });
  }

  if (onTracksReordered) {
    const handler = (payload: any) => {
      if (payload.roomId === roomId) {
        onTracksReordered(payload.tracks);
      }
    };
    s.on("tracks-reordered", handler);
    handlerRefs.push({ event: "tracks-reordered", handler });
  }

  if (onMoodItemAdded) {
    const handler = (payload: any) => {
      if (payload.roomId === roomId) {
        onMoodItemAdded(payload.item);
      }
    };
    s.on("mood-item-added", handler);
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
    s.on("now-playing-changed", handler);
    handlerRefs.push({ event: "now-playing-changed", handler });
  }

  if (onRoomUsersChanged) {
    const handler = (payload: any) => {
      if (payload.roomId === roomId) {
        onRoomUsersChanged(payload.count);
      }
    };
    s.on("room-users", handler);
    handlerRefs.push({ event: "room-users", handler });
  }

  if (onRoomThemeChanged) {
    const handler = (payload: any) => {
      if (payload.roomId === roomId) {
        onRoomThemeChanged(payload.theme);
      }
    };
    s.on("room-theme-changed", handler);
    handlerRefs.push({ event: "room-theme-changed", handler });
  }

  if (onChatMessageAdded) {
    const handler = (payload: any) => {
      if (payload.roomId === roomId) {
        onChatMessageAdded(payload.message);
      }
    };
    s.on("chat-message-added", handler);
    handlerRefs.push({ event: "chat-message-added", handler });
  }

  if (onNowPlayingState) {
    const handler = (payload: any) => {
      // Filter by roomId if provided, otherwise accept (for backward compatibility with direct socket.emit)
      if (payload?.roomId && payload.roomId !== roomId) {
        return;
      }
      const trackId = payload?.trackId ?? null;
      const startedAt = payload?.startedAt ?? null;
      onNowPlayingState(trackId, startedAt);
    };
    s.on("now-playing-state", handler);
    handlerRefs.push({ event: "now-playing-state", handler });
  }

  // unsubscribe function
  return () => {
    if (!s) return;
    const currentSocket = s;
    handlerRefs.forEach(({ event, handler }) => {
      currentSocket.off(event, handler);
    });
  };
}
