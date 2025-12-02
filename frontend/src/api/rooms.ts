import { RoomThemeId } from "../theme";
import api from "./client";

export type Room = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  createdBy?: string;
  invitedUsers?: string[];
  roomCode?: string;
  nowPlayingTrackId?: string | null;
  nowPlayingStartedAt?: number | null;
  theme: RoomThemeId;
};

export type Track = {
  [x: string]: string;
  id: string;
  url: string;
  thumbnail: string;
  title: string;
  author: string;
};

export type MoodItem = {
  id: string;
  type: "gif" | "image";
  url: string;
  caption?: string;
};

export async function fetchRooms(): Promise<Room[]> {
  const res = await api.get<Room[]>("/rooms");
  return res.data;
}

export async function createRoom(data: { name: string; description?: string }) {
  const res = await api.post<Room>("/rooms", data);
  return res.data;
}

export async function fetchRoom(roomId: string): Promise<Room> {
  const res = await api.get<Room>(`/rooms/${roomId}`);
  return res.data;
}

export async function fetchRoomBySlug(slug: string): Promise<Room> {
  const res = await api.get<Room>(`/rooms/slug/${slug}`);
  return res.data;
}

export async function fetchTracks(roomId: string): Promise<Track[]> {
  const res = await api.get<Track[]>(`/rooms/${roomId}/tracks`);
  return res.data;
}

export async function addTrack(
  roomId: string,
  data: { url: string; note?: string }
) {
  const res = await api.post<Track>(`/rooms/${roomId}/tracks`, data);
  return res.data;
}

export async function voteTrack(
  roomId: string,
  trackId: string,
  value: 1 | -1
) {
  const res = await api.post<Track>(
    `/rooms/${roomId}/tracks/${trackId}/vote`,
    { value }
  );
  return res.data;
}

export async function fetchMoodItems(roomId: string): Promise<MoodItem[]> {
  const res = await api.get<MoodItem[]>(`/rooms/${roomId}/mood-items`);
  return res.data;
}

export async function addMoodItem(
  roomId: string,
  data: { type: "gif"; url: string; caption?: string }
) {
  const res = await api.post<MoodItem>(
    `/rooms/${roomId}/mood-items`,
    data
  );
  return res.data;
}

export async function setNowPlaying(
  roomId: string,
  trackId: string | null
): Promise<Room> {
  const res = await api.post<Room>(`/rooms/${roomId}/now-playing`, {
    trackId,
  });
  return res.data;
}

export async function updateRoomTheme(roomId: string, theme: RoomThemeId) {
  const res = await api.patch<Room>(`/rooms/${roomId}/theme`, { theme });
  return res.data;
}

export async function inviteUserToRoom(roomId: string, email: string) {
  const res = await api.post<{ success: boolean; message: string }>(
    `/rooms/${roomId}/invite`,
    { email }
  );
  return res.data;
}

export async function joinRoomByCode(code: string) {
  const res = await api.post<{ room: Room; success?: boolean; alreadyMember?: boolean }>(
    "/rooms/join",
    { code }
  );
  return res.data;
}

export async function regenerateRoomCode(roomId: string) {
  const res = await api.post<{ room: Room; roomCode: string }>(
    `/rooms/${roomId}/regenerate-code`
  );
  return res.data;
}

export async function deleteRoom(roomId: string) {
  const res = await api.delete<{ success: boolean; message: string }>(
    `/rooms/${roomId}`
  );
  return res.data;
}

export async function advanceToNextTrack(roomId: string) {
  const res = await api.post<{ nextTrackId: string | null; room?: Room; message?: string }>(
    `/rooms/${roomId}/next-track`
  );
  return res.data;
}
