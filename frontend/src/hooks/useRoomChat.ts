import { useEffect, useState } from "react";
import { ChatMessage, fetchChatMessages, sendChatMessage } from "../api/chat";
import { getSocket, subscribeToRoomEvents, leaveRoom } from "../sockets/socket";

export function useRoomChat(roomId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const loadMessages = async () => {
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

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    try {
      setSending(true);
      const msg = await sendChatMessage(roomId, text);
      // optimistic update; socket will also push, but we'll de-dupe in listener
      setMessages((prev) => [...prev, msg]);
    } catch (e) {
      console.log("Error sending chat message", e);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    let unsubscribeEvents: (() => void) | null = null;

    (async () => {
      await loadMessages();

      const socket = await getSocket();
      unsubscribeEvents = subscribeToRoomEvents(roomId, {
        onChatMessageAdded: (msg) => {
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        },
      });
    })();

    return () => {
      if (unsubscribeEvents) unsubscribeEvents();
      // leaveRoom here is optional; main hook already does it, so you can omit
      // leaveRoom(roomId);
    };
  }, [roomId]);

  return {
    messages,
    loading,
    sending,
    handleSend,
  };
}
