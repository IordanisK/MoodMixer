import api from "./client";

export type MessageType = "text" | "image" | "gif" | "voice";

export type ChatMessage = {
  id: string;
  type: MessageType;
  text?: string;
  imageUrl?: string;
  gifUrl?: string;
  voiceUrl?: string;
  voiceDuration?: number; // in seconds
  userId: string;
  userName: string;
  createdAt?: any;
};

export async function fetchChatMessages(roomId: string): Promise<ChatMessage[]> {
  const res = await api.get<ChatMessage[]>(`/rooms/${roomId}/chat`);
  return res.data;
}

export async function sendChatMessage(
  roomId: string,
  message: {
    type: MessageType;
    text?: string;
    imageUrl?: string;
    gifUrl?: string;
    voiceUrl?: string;
    voiceDuration?: number;
  }
): Promise<ChatMessage> {
  const res = await api.post<ChatMessage>(`/rooms/${roomId}/chat`, message);
  return res.data;
}

export async function uploadChatImage(
  roomId: string,
  imageBase64: string
): Promise<{ url: string }> {
  const res = await api.post<{ url: string }>(`/rooms/${roomId}/chat/upload-image`, {
    image: imageBase64,
  });
  return res.data;
}

export async function uploadVoiceMessage(
  roomId: string,
  audioBase64: string,
  duration: number
): Promise<{ url: string }> {
  const res = await api.post<{ url: string }>(`/rooms/${roomId}/chat/upload-voice`, {
    audio: audioBase64,
    duration,
  });
  return res.data;
}
