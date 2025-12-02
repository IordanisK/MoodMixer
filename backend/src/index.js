import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";

import { db, admin } from "./firebaseAdmin.js";
import { registerApiRoutes } from "./routes/api.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"], // Support both transports
  allowEIO3: true, // Allow Engine.IO v3 clients
  // NOTE: If running multiple instances (e.g., Cloud Run with max instances > 1),
  // you need to use Redis adapter for Socket.io to share room state across instances.
  // See: https://socket.io/docs/v4/redis-adapter/
  // Example: const { createAdapter } = require("@socket.io/redis-adapter");
  //          const { createClient } = require("redis");
  //          const pubClient = createClient({ url: "redis://..." });
  //          const subClient = pubClient.duplicate();
  //          await Promise.all([pubClient.connect(), subClient.connect()]);
  //          io.adapter(createAdapter(pubClient, subClient));
});

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

/**
 * Basic health check – public
 */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "MoodMixer API running with Firebase + Socket.io",
  });
});

/**
 * Socket.io auth + events
 */
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));

    const decoded = await admin.auth().verifyIdToken(token);
    socket.user = decoded;
    next();
  } catch (err) {
    // Only log non-expired token errors to reduce noise
    if (err.code !== "auth/id-token-expired") {
      console.error("Socket auth error:", err);
    }
    next(new Error("Unauthorized"));
  }
});

// NOTE: We no longer use a manual roomMembers counter.
// Instead, we use io.sockets.adapter.rooms.get(roomId).size to get the actual
// number of sockets in a room. This is more reliable and prevents discrepancies
// from unexpected disconnects or errors.

/**
 * Helper function to check if a user has access to a room
 */
async function checkRoomAccess(roomId, userId) {
  const doc = await db.collection("rooms").doc(roomId).get();
  if (!doc.exists) return { hasAccess: false };

  const room = doc.data();
  const isCreator = room.createdBy === userId;
  const isInvited = (room.invitedUsers || []).includes(userId);

  return {
    hasAccess: isCreator || isInvited,
  };
}

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id, "user:", socket.user?.uid);

  /**
   * JOIN ROOM
   *
   * IMPORTANT: All socket operations are room-based, NOT user-based.
   * - Sockets join rooms using roomId: socket.join(roomId)
   * - Events are broadcast to rooms: io.to(roomId).emit(...)
   * - This ensures all users in a room receive the same events
   *
   * When a user joins a room, they automatically leave any previous rooms
   * to ensure each socket is only in one room at a time.
   */
  socket.on("join-room", async (roomId) => {
    const userId = socket.user?.uid;
    if (!userId) {
      socket.emit("error", { message: "Unauthorized" });
      return;
    }

    try {
      const { hasAccess } = await checkRoomAccess(roomId, userId);
      if (!hasAccess) {
        socket.emit("error", { message: "Access denied to this room" });
        return;
      }

      // IMPORTANT: Leave all other rooms before joining the new one
      // This ensures the socket is only in one room at a time
      // Socket.io rooms: socket.rooms includes the socket's own ID room, so we skip that
      for (const existingRoomId of socket.rooms) {
        if (existingRoomId === socket.id) continue; // Skip the socket's own ID room
        if (existingRoomId !== roomId) {
          console.log(
            `🔄 User ${userId} leaving room ${existingRoomId} before joining ${roomId}`
          );
          socket.leave(existingRoomId);

          // Get the actual room size from Socket.io adapter (source of truth)
          const existingRoom = io.sockets.adapter.rooms.get(existingRoomId);
          const existingRoomSize = existingRoom ? existingRoom.size : 0;

          io.to(existingRoomId).emit("room-users", {
            roomId: existingRoomId,
            count: existingRoomSize,
          });
        }
      }

      socket.join(roomId);

      // Get the actual room size from Socket.io adapter (source of truth)
      const room = io.sockets.adapter.rooms.get(roomId);
      const roomSize = room ? room.size : 0;

      console.log(
        `User ${userId} joined room ${roomId} (room now has ${roomSize} socket(s))`
      );

      // TEST EVENT: Broadcast to all users in the room when someone joins
      console.log(
        `📢 Broadcasting test-user-joined to room ${roomId} (${roomSize} socket(s))`
      );
      io.to(roomId).emit("test-user-joined", {
        roomId,
        userId,
        userName: socket.user?.name || socket.user?.email || "Unknown User",
        timestamp: Date.now(),
      });

      // Send current now-playing state to the newly joined user
      const roomDoc = await db.collection("rooms").doc(roomId).get();
      if (roomDoc.exists) {
        const roomData = roomDoc.data();
        const nowPlayingTrackId = roomData?.nowPlayingTrackId || null;
        const nowPlayingStartedAt = roomData?.nowPlayingStartedAt
          ? roomData.nowPlayingStartedAt.toMillis()
          : null;

        socket.emit("now-playing-state", {
          roomId,
          trackId: nowPlayingTrackId,
          startedAt: nowPlayingStartedAt,
        });
      }

      // Use actual room size from Socket.io adapter (more reliable than manual counter)
      io.to(roomId).emit("room-users", {
        roomId,
        count: roomSize,
      });
    } catch (err) {
      console.error("Error checking room access for socket:", err);
      socket.emit("error", { message: "Error joining room" });
    }
  });

  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);

    // Get the actual room size from Socket.io adapter (source of truth)
    const room = io.sockets.adapter.rooms.get(roomId);
    const roomSize = room ? room.size : 0;

    io.to(roomId).emit("room-users", {
      roomId,
      count: roomSize,
    });

    console.log(
      `User ${socket.user?.uid} left room ${roomId} (room now has ${roomSize} socket(s))`
    );
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue; // Skip the socket's own ID room

      // Get the actual room size from Socket.io adapter (source of truth)
      // Note: socket is still in the room during "disconnecting", so we subtract 1
      const room = io.sockets.adapter.rooms.get(roomId);
      const roomSize = room ? Math.max(0, room.size - 1) : 0;

      io.to(roomId).emit("room-users", {
        roomId,
        count: roomSize,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

/**
 * HTTP API routes (rooms, tracks, mood, chat, Spotify, etc.)
 * All defined in routes/api.js
 */
registerApiRoutes(app, io, db, admin);

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`MoodMixer API listening on port ${PORT}`);
});
