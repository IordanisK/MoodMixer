import api from "./client";

export type ChatMessage = {
  id: string;
  text: string;
  userId: string;
  userName: string;
  createdAt?: any; // Firestore timestamp or ISO, we'll render loosely
};

export async function fetchChatMessages(roomId: string): Promise<ChatMessage[]> {
  const res = await api.get<ChatMessage[]>(`/rooms/${roomId}/chat`);
  return res.data;
}

export async function sendChatMessage(
  roomId: string,
  text: string
): Promise<ChatMessage> {
  const res = await api.post<ChatMessage>(`/rooms/${roomId}/chat`, { text });
  return res.data;
}
