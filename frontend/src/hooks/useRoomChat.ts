import { useEffect, useState, useRef } from "react";
import { ChatMessage, fetchChatMessages, sendChatMessage } from "../api/chat";
import { getSocket, subscribeToRoomEvents, leaveRoom } from "../sockets/socket";
import { auth } from "../firebase";

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

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    try {
      setSending(true);
      const msg = await sendChatMessage(roomId, text);
      // Mark this message ID as pending so we don't add it twice from socket
      pendingMessageIds.current.add(msg.id);
      // Optimistic update - add message immediately
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } catch (e) {
      console.log("Error sending chat message", e);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!roomId) return;

    let unsubscribeEvents: (() => void) | null = null;

    (async () => {
      await loadMessages();

      const socket = await getSocket();
      
      // Ensure we've joined the room before subscribing to events
      // (useRoomDetail also joins, but this ensures no race condition)
      socket.emit("join-room", roomId);
      
      unsubscribeEvents = subscribeToRoomEvents(roomId, {
        onChatMessageAdded: (msg) => {
          console.log("📨 Chat message received via socket:", msg);
          setMessages((prev) => {
            // Check if message already exists by ID
            if (prev.find((m) => m.id === msg.id)) {
              return prev;
            }
            // Remove from pending set if it was there
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
    handleSend,
  };
}
