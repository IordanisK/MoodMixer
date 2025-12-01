import api from "./client";

export type PlayHistoryEntry = {
  id: string;
  trackId: string;
  url: string;
  note: string;
  title: string;
  author: string;
  thumbnail: string;
  provider: string;
  startedAt?: any;
  mode: "manual" | "auto";
  setByUserId?: string | null;
  roomTheme?: string;
};

export async function fetchPlayHistory(
  roomId: string
): Promise<PlayHistoryEntry[]> {
  const res = await api.get<PlayHistoryEntry[]>(`/rooms/${roomId}/history`);
  return res.data;
}
