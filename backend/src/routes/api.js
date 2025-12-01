import express from "express";
import fetch from "node-fetch";
import querystring from "querystring";
import { authMiddleware } from "../middleware/auth.js";

/**
 * All HTTP routes for MoodMixer live here.
 *
 * We receive app/io/db/admin from index.js so we don't import firebase again.
 */
export function registerApiRoutes(app, io, db, admin) {
  const router = express.Router();

  const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
  const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
  const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
  const SPOTIFY_FRONTEND_URL = process.env.SPOTIFY_FRONTEND_URL;

  const spotifyUsersRef = db.collection("spotifyUsers");

  function mapRoomDoc(doc) {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      nowPlayingStartedAt: data.nowPlayingStartedAt
        ? data.nowPlayingStartedAt.toMillis()
        : null,
    };
  }

  /**
   * PUBLIC routes (no authMiddleware)
   * - Spotify OAuth callback
   * - Metadata fetch (optional to keep public)
   */

  // --- TRACK METADATA FETCH (YouTube + Spotify oEmbed) ---
  router.get("/metadata", async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "url required" });

    try {
      let oembedUrl = null;

      if (url.includes("youtube.com") || url.includes("youtu.be")) {
        oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
          url
        )}&format=json`;
      } else if (url.includes("spotify.com")) {
        oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(
          url
        )}`;
      }

      if (!oembedUrl) {
        return res.json({
          provider: "unknown",
          title: "",
          author: "",
          thumbnail: "",
        });
      }

      const response = await fetch(oembedUrl);
      if (!response.ok) throw new Error("oEmbed request failed");

      const data = await response.json();

      res.json({
        provider: data.provider_name?.toLowerCase() || "unknown",
        title: data.title || "",
        author: data.author_name || "",
        thumbnail: data.thumbnail_url || "",
      });
    } catch (err) {
      console.error("Error fetching metadata", err);
      res.status(500).json({ error: "Metadata fetch failed" });
    }
  });

  // GET /auth/spotify/callback (public – Spotify calls this, no JWT)
  router.get("/auth/spotify/callback", async (req, res) => {
    const { code, state, error } = req.query;
    console.log("Spotify callback hit", { hasCode: !!code, hasState: !!state, error });

    if (error) {
      console.error("Spotify auth error:", error);
      return res.redirect(`${SPOTIFY_FRONTEND_URL}?spotify=error`);
    }

    if (!code || !state) {
      return res.redirect(`${SPOTIFY_FRONTEND_URL}?spotify=missing`);
    }

    let payload;
    try {
      payload = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    } catch (e) {
      console.error("Invalid Spotify state", e);
      return res.redirect(`${SPOTIFY_FRONTEND_URL}?spotify=state_invalid`);
    }

    const userId = payload.userId;
    if (!userId) {
      console.error("No userId in Spotify state");
      return res.redirect(`${SPOTIFY_FRONTEND_URL}?spotify=state_no_user`);
    }

    try {
      const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(
              `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
            ).toString("base64"),
        },
        body: querystring.stringify({
          grant_type: "authorization_code",
          code,
          redirect_uri: SPOTIFY_REDIRECT_URI,
        }),
      });

      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) {
        console.error("Spotify token error:", tokenJson);
        return res.redirect(`${SPOTIFY_FRONTEND_URL}?spotify=token_error`);
      }

      const { refresh_token } = tokenJson;

      if (!refresh_token) {
        console.error("No refresh_token from Spotify");
        return res.redirect(`${SPOTIFY_FRONTEND_URL}?spotify=no_refresh`);
      }

      await spotifyUsersRef.doc(userId).set(
        {
          refreshToken: refresh_token,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return res.redirect(`${SPOTIFY_FRONTEND_URL}?spotify=connected`);
    } catch (err) {
      console.error("Error in Spotify callback", err);
      return res.redirect(`${SPOTIFY_FRONTEND_URL}?spotify=error`);
    }
  });

  /**
   * From here on, everything requires auth
   */
  router.use(authMiddleware);

  /**
   * ROOMS
   */
  router.get("/rooms", async (req, res) => {
    try {
      const snapshot = await db
        .collection("rooms")
        .orderBy("createdAt", "desc")
        .get();

      const rooms = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      res.json(rooms);
    } catch (err) {
      console.error("Error getting rooms", err);
      res.status(500).json({ error: "Failed to fetch rooms" });
    }
  });

  router.get("/rooms/:roomId", async (req, res) => {
    const { roomId } = req.params;
    try {
      const doc = await db.collection("rooms").doc(roomId).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Room not found" });
      }
      const room = mapRoomDoc(doc);
      res.json(room);
    } catch (err) {
      console.error("Error fetching room", err);
      res.status(500).json({ error: "Error fetching room" });
    }
  });

  router.post("/rooms", async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    try {
      const newRoom = {
        name,
        description: description || "",
        createdBy: req.user.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        nowPlayingTrackId: null,
        nowPlayingSetBy: null,
        nowPlayingAt: null,
        theme: "synthwave",
        autoDjEnabled: false,
      };

      const ref = await db.collection("rooms").add(newRoom);
      const createdDoc = await ref.get();

      const roomWithId = { id: ref.id, ...createdDoc.data() };
      res.status(201).json(roomWithId);
    } catch (err) {
      console.error("Error creating room", err);
      res.status(500).json({ error: "Failed to create room" });
    }
  });

  /**
   * TRACKS
   */
  router.get("/rooms/:roomId/tracks", async (req, res) => {
    const { roomId } = req.params;
    try {
      const snapshot = await db
        .collection("rooms")
        .doc(roomId)
        .collection("tracks")
        .orderBy("createdAt", "desc")
        .get();

      const tracks = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      res.json(tracks);
    } catch (err) {
      console.error("Error getting tracks", err);
      res.status(500).json({ error: "Failed to fetch tracks" });
    }
  });

  // POST /rooms/:roomId/tracks
  router.post("/rooms/:roomId/tracks", async (req, res) => {
    const { roomId } = req.params;
    const { url, note } = req.body;

    if (!url || !url.trim()) {
      return res.status(400).json({ error: "url is required" });
    }

    try {
      const userId = req.user?.uid || "anonymous";

      const roomRef = db.collection("rooms").doc(roomId);
      const tracksRef = roomRef.collection("tracks");

      let provider = "other";
      if (url.includes("youtube.com") || url.includes("youtu.be")) {
        provider = "youtube";
      } else if (url.includes("spotify.com")) {
        provider = "spotify";
      }

      const newTrack = {
        url: url.trim(),
        note: note?.trim() || "",
        upvotes: 0,
        downvotes: 0,
        createdBy: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        provider,
        title: "",
        author: "",
        thumbnail: "",
      };

      const docRef = await tracksRef.add(newTrack);
      const snap = await docRef.get();
      const saved = { id: docRef.id, ...snap.data() };

      io.to(roomId).emit("track-added", saved);

      return res.status(201).json(saved);
    } catch (err) {
      console.error("Error adding track", err);
      return res.status(500).json({ error: "Error adding track" });
    }
  });

  router.post("/rooms/:roomId/tracks/:trackId/vote", async (req, res) => {
    const { roomId, trackId } = req.params;
    const { value } = req.body;
    const userId = req.user.uid;

    if (![1, -1].includes(value)) {
      return res.status(400).json({ error: "value must be 1 or -1" });
    }

    try {
      const trackRef = db
        .collection("rooms")
        .doc(roomId)
        .collection("tracks")
        .doc(trackId);

      await db.runTransaction(async (t) => {
        const doc = await t.get(trackRef);
        if (!doc.exists) throw new Error("Track not found");

        const data = doc.data();
        const voters = data.voters || {};
        const prevVote = voters[userId] || 0;

        let upvotes = data.upvotes || 0;
        let downvotes = data.downvotes || 0;

        if (prevVote === 1) upvotes -= 1;
        else if (prevVote === -1) downvotes -= 1;

        if (value === 1) upvotes += 1;
        else if (value === -1) downvotes += 1;

        voters[userId] = value;

        t.update(trackRef, { upvotes, downvotes, voters });
      });

      const updatedDoc = await trackRef.get();
      const updatedTrack = { id: updatedDoc.id, ...updatedDoc.data() };

      io.to(roomId).emit("track-updated", { roomId, track: updatedTrack });

      res.json(updatedTrack);
    } catch (err) {
      console.error("Error voting track", err);
      if (err.message === "Track not found") {
        return res.status(404).json({ error: "Track not found" });
      }
      res.status(500).json({ error: "Failed to vote track" });
    }
  });

  /**
   * MOOD ITEMS
   */
  router.get("/rooms/:roomId/mood-items", async (req, res) => {
    const { roomId } = req.params;

    try {
      const snapshot = await db
        .collection("rooms")
        .doc(roomId)
        .collection("moodItems")
        .orderBy("createdAt", "desc")
        .get();

      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      res.json(items);
    } catch (err) {
      console.error("Error getting mood items", err);
      res.status(500).json({ error: "Failed to fetch mood items" });
    }
  });

  router.post("/rooms/:roomId/mood-items", async (req, res) => {
    const { roomId } = req.params;
    const { type, url, caption } = req.body;

    if (!type || !url) {
      return res.status(400).json({ error: "type and url are required" });
    }

    try {
      const newItem = {
        type,
        url,
        caption: caption || "",
        createdBy: req.user.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const ref = await db
        .collection("rooms")
        .doc(roomId)
        .collection("moodItems")
        .add(newItem);

      const createdDoc = await ref.get();
      const itemWithId = { id: ref.id, ...createdDoc.data() };

      io.to(roomId).emit("mood-item-added", { roomId, item: itemWithId });

      res.status(201).json(itemWithId);
    } catch (err) {
      console.error("Error adding mood item", err);
      res.status(500).json({ error: "Failed to add mood item" });
    }
  });

  /**
   * NOW PLAYING
   */
  router.post("/rooms/:roomId/now-playing", async (req, res) => {
    const { roomId } = req.params;
    const { trackId } = req.body;

    try {
      const roomRef = db.collection("rooms").doc(roomId);

      if (trackId) {
        await roomRef.update({
          nowPlayingTrackId: trackId,
          nowPlayingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await roomRef.update({
          nowPlayingTrackId: null,
          nowPlayingStartedAt: null,
        });
      }

      const snap = await roomRef.get();
      const room = mapRoomDoc(snap);
      const startedAt = room.nowPlayingStartedAt || null;

      io.to(roomId).emit("now-playing-changed", trackId || null);
      io.to(roomId).emit("now-playing-state", {
        trackId: trackId || null,
        startedAt,
      });

      res.json(room);
    } catch (err) {
      console.error("Error setting now playing", err);
      res.status(500).json({ error: "Error setting now playing" });
    }
  });

  /**
   * ROOM THEME
   */
  router.patch("/rooms/:roomId/theme", async (req, res) => {
    const { roomId } = req.params;
    const { theme } = req.body;

    if (!["synthwave", "chill", "sunset", "forest"].includes(theme)) {
      return res.status(400).json({ error: "Invalid theme" });
    }

    try {
      const roomRef = db.collection("rooms").doc(roomId);
      await roomRef.update({ theme });

      const doc = await roomRef.get();
      const room = { id: doc.id, ...doc.data() };

      io.to(roomId).emit("room-theme-changed", {
        roomId,
        theme,
      });

      res.json(room);
    } catch (err) {
      console.error("Error updating room theme", err);
      res.status(500).json({ error: "Error updating room theme" });
    }
  });

  /**
   * CHAT
   */
  router.get("/rooms/:roomId/chat", async (req, res) => {
    const { roomId } = req.params;

    try {
      const snap = await db
        .collection("rooms")
        .doc(roomId)
        .collection("chatMessages")
        .orderBy("createdAt", "asc")
        .limit(100)
        .get();

      const messages = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.json(messages);
    } catch (err) {
      console.error("Error fetching chat messages", err);
      res.status(500).json({ error: "Error fetching chat messages" });
    }
  });

  router.post("/rooms/:roomId/chat", async (req, res) => {
    const { roomId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "text is required" });
    }

    try {
      const userId = req.user.uid;
      const userName =
        req.user.name || req.user.displayName || req.user.email || "Anon DJ";

      const msg = {
        text: text.trim(),
        userId,
        userName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const colRef = db
        .collection("rooms")
        .doc(roomId)
        .collection("chatMessages");

      const docRef = await colRef.add(msg);
      const savedSnap = await docRef.get();
      const saved = { id: docRef.id, ...savedSnap.data() };

      io.to(roomId).emit("chat-message-added", {
        roomId,
        message: saved,
      });

      res.status(201).json(saved);
    } catch (err) {
      console.error("Error adding chat message", err);
      res.status(500).json({ error: "Error adding chat message" });
    }
  });

  /**
   * PLAY HISTORY
   */
  router.get("/rooms/:roomId/history", async (req, res) => {
    const { roomId } = req.params;

    try {
      const snap = await db
        .collection("rooms")
        .doc(roomId)
        .collection("playHistory")
        .orderBy("startedAt", "desc")
        .limit(50)
        .get();

      const history = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.json(history);
    } catch (err) {
      console.error("Error fetching play history", err);
      res.status(500).json({ error: "Error fetching play history" });
    }
  });

  /**
   * SPOTIFY (login-url + player-token) – authed
   */

  // POST /spotify/login-url
  router.post("/spotify/login-url", async (req, res) => {
    try {
      const userId = req.user.uid;

      const state = Buffer.from(
        JSON.stringify({
          userId,
          ts: Date.now(),
        })
      ).toString("base64url");

      const scope = [
        "streaming",
        "user-read-email",
        "user-read-private",
        "user-modify-playback-state",
        "user-read-playback-state",
      ].join(" ");

      const params = querystring.stringify({
        client_id: SPOTIFY_CLIENT_ID,
        response_type: "code",
        redirect_uri: SPOTIFY_REDIRECT_URI,
        scope,
        state,
      });

      const url = `https://accounts.spotify.com/authorize?${params}`;
      res.json({ url });
    } catch (err) {
      console.error("Error building Spotify login URL", err);
      res.status(500).json({ error: "Error building Spotify login URL" });
    }
  });

  // GET /spotify/player-token
  router.get("/spotify/player-token", async (req, res) => {
    const userId = req.user.uid;

    try {
      const doc = await spotifyUsersRef.doc(userId).get();
      console.log("spotifyUsers doc exists?", doc.exists);

      if (!doc.exists) {
        return res.status(404).json({ error: "Spotify not connected" });
      }

      const data = doc.data() || {};
      const refreshToken = data.refreshToken;

      if (!refreshToken) {
        return res.status(404).json({ error: "Spotify not connected" });
      }

      const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(
              `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
            ).toString("base64"),
        },
        body: querystring.stringify({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      });

      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) {
        console.error("Error refreshing Spotify token:", tokenJson);
        return res.status(500).json({ error: "Error refreshing Spotify token" });
      }

      const { access_token, expires_in } = tokenJson;

      res.json({
        accessToken: access_token,
        expiresIn: expires_in,
      });
    } catch (err) {
      console.error("Error getting Spotify player token", err);
      res.status(500).json({ error: "Error getting Spotify player token" });
    }
  });

  // Mount router on app (no prefix so paths stay the same)
  app.use(router);
}
