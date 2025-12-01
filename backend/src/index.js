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
});

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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
    console.error("Socket auth error:", err);
    next(new Error("Unauthorized"));
  }
});

const roomMembers = {};

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

      socket.join(roomId);
      roomMembers[roomId] = (roomMembers[roomId] || 0) + 1;
      console.log(`User ${userId} joined room ${roomId}`);

      io.to(roomId).emit("room-users", {
        roomId,
        count: roomMembers[roomId],
      });
    } catch (err) {
      console.error("Error checking room access for socket:", err);
      socket.emit("error", { message: "Error joining room" });
    }
  });

  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    if (roomMembers[roomId]) {
      roomMembers[roomId] = Math.max(0, roomMembers[roomId] - 1);
      io.to(roomId).emit("room-users", {
        roomId,
        count: roomMembers[roomId],
      });
    }
    console.log(`User ${socket.user?.uid} left room ${roomId}`);
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;
      if (roomMembers[roomId]) {
        roomMembers[roomId] = Math.max(0, roomMembers[roomId] - 1);
        io.to(roomId).emit("room-users", {
          roomId,
          count: roomMembers[roomId],
        });
      }
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

httpServer.listen(PORT, () => {
  console.log(`MoodMixer API listening on http://127.0.0.1:${PORT}`);
});
