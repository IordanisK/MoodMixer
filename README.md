# MoodMixer 🎧

MoodMixer is a collaborative **music & moodboard** platform.

Users join themed rooms, drop tracks from **YouTube** and **Spotify**, vote, chat, share GIFs, and enjoy synced “Now Playing” playback together – all in real time.

---

## Features

- 🔐 Email / Google login (Firebase Auth)
- 🎛️ Create & join music rooms (e.g. “Chill Vibes”, “Friday Night”)
- 🎵 Add tracks from YouTube & Spotify
- 🧠 Auto metadata (title, artist, thumbnail)
- 🎧 “Now Playing” bar with synced playback (web)
- 🗳️ Voting (up/down) per track
- 🌈 Room themes & animated scenes
- 🎭 Mood GIF / image strip
- 💬 Real-time chat per room
- 👥 Live presence counter (who’s in the room)
- ⚡ Real-time updates via Socket.io

---

## Tech Stack

### Frontend

- **React Native** (Expo – mobile + web from one codebase)
- **TypeScript**
- Animated UI / scene layers (Framer Motion / RN Animated)
- **YouTube IFrame API** (web playback)
- **Spotify Web Playback SDK** (web Spotify playback)
- React Navigation

### Backend

- **Node.js + Express**
- **Socket.io** for real-time events (tracks, chat, themes, presence)
- **Firebase Admin SDK**
- **Firestore** as main database
- Spotify OAuth2 + Web Playback token endpoint

### Cloud / Infra

- **Google Cloud Firestore**
- **Firebase Auth**
- Hosted Node.js backend (local dev on port `4000`)
- CI via **GitHub Actions** (Node LTS)

---

## Project Structure

```text
moodmixer/
  frontend/      # Expo + React Native app (mobile + web)
  backend/       # Node + Express + Socket.io + Firebase Admin
  .github/       # CI workflows
  README.md
  LICENSE
