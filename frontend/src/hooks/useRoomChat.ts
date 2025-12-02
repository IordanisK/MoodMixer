import { useEffect, useState, useRef, useCallback } from "react";
import {
  ChatMessage,
  fetchChatMessages,
  sendChatMessage,
  uploadChatImage,
  uploadVoiceMessage,
} from "../api/chat";
import { getSocket, subscribeToRoomEvents } from "../sockets/socket";

export function useRoomChat(roomId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const pendingMessageIds = useRef<Set<string>>(new Set());

  const loadMessages = async () => {
    if (!roomId) return;
    try {
      setLoading(true);
      const data = await fetchChatMessages(roomId);
      setMessages(data);
    } catch (e) {
      console.log("Error loading chat messages", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendText = useCallback(async (text: string) => {
    if (!text.trim()) return;
    try {
      setSending(true);
      const msg = await sendChatMessage(roomId, { type: "text", text });
      pendingMessageIds.current.add(msg.id);
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } catch (e) {
      console.log("Error sending chat message", e);
    } finally {
      setSending(false);
    }
  }, [roomId]);

  const handleSendImage = useCallback(async (imageBase64: string) => {
    try {
      setSending(true);
      // Upload image first
      const { url } = await uploadChatImage(roomId, imageBase64);
      // Then send message with image URL
      const msg = await sendChatMessage(roomId, { type: "image", imageUrl: url });
      pendingMessageIds.current.add(msg.id);
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } catch (e) {
      console.log("Error sending image message", e);
    } finally {
      setSending(false);
    }
  }, [roomId]);

  const handleSendGif = useCallback(async (gifUrl: string) => {
    try {
      setSending(true);
      const msg = await sendChatMessage(roomId, { type: "gif", gifUrl });
      pendingMessageIds.current.add(msg.id);
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } catch (e) {
      console.log("Error sending GIF message", e);
    } finally {
      setSending(false);
    }
  }, [roomId]);

  const handleSendVoice = useCallback(async (audioBase64: string, duration: number) => {
    try {
      setSending(true);
      // Upload voice first
      const { url } = await uploadVoiceMessage(roomId, audioBase64, duration);
      // Then send message with voice URL
      const msg = await sendChatMessage(roomId, {
        type: "voice",
        voiceUrl: url,
        voiceDuration: duration,
      });
      pendingMessageIds.current.add(msg.id);
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } catch (e) {
      console.log("Error sending voice message", e);
    } finally {
      setSending(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    let unsubscribeEvents: (() => void) | null = null;

    (async () => {
      await loadMessages();

      const socket = await getSocket();
      
      // Ensure we've joined the room before subscribing to events
      socket.emit("join-room", roomId);
      
      unsubscribeEvents = subscribeToRoomEvents(roomId, {
        onChatMessageAdded: (msg) => {
          console.log("📨 Chat message received via socket:", msg);
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) {
              return prev;
            }
            pendingMessageIds.current.delete(msg.id);
            return [...prev, msg];
          });
        },
      });
    })();

    return () => {
      if (unsubscribeEvents) unsubscribeEvents();
      pendingMessageIds.current.clear();
    };
  }, [roomId]);

  return {
    messages,
    loading,
    sending,
    handleSendText,
    handleSendImage,
    handleSendGif,
    handleSendVoice,
  };
}
