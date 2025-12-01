import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { ChatMessage } from "../../api/chat";
import { colors, radii, spacing, roomThemes, RoomThemeId } from "../../theme";

type Props = {
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  onSend: (text: string) => void;
  roomTheme: RoomThemeId;
};

export default function RoomChat({
  messages,
  loading,
  sending,
  onSend,
  roomTheme,
}: Props) {
  const [text, setText] = useState("");
  const theme = roomThemes[roomTheme] || roomThemes.synthwave;

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSend(text);
    setText("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Room chat</Text>
      <Text style={styles.subtitle}>
        Talk about the vibe, plan the next drop.
      </Text>

      <View style={styles.messagesCard}>
        {loading && messages.length === 0 ? (
          <Text style={styles.helperText}>Loading messages…</Text>
        ) : messages.length === 0 ? (
          <Text style={styles.helperText}>
            No messages yet. Say hi 👋
          </Text>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            scrollEnabled={false} // outer ScrollView handles scrolling
            renderItem={({ item }) => (
              <View style={styles.messageRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.userName?.[0]?.toUpperCase() || "?"}
                  </Text>
                </View>
                <View style={styles.bubbleWrapper}>
                  <View
                    style={[
                      styles.bubble,
                      { borderColor: theme.accentSoft },
                    ]}
                  >
                    <Text style={styles.userName}>{item.userName}</Text>
                    <Text style={styles.messageText}>{item.text}</Text>
                  </View>
                </View>
              </View>
            )}
          />
        )}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Drop a message…"
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: theme.accent }]}
          onPress={handleSubmit}
          disabled={sending || !text.trim()}
          activeOpacity={0.85}
        >
          <Text style={styles.sendText}>{sending ? "…" : "Send"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  messagesCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(55,65,81,0.8)",
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 12,
    paddingVertical: spacing.sm,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 4,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: "rgba(31,41,55,1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  avatarText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  bubbleWrapper: {
    flex: 1,
  },
  bubble: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(15,23,42,0.9)",
  },
  userName: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  messageText: {
    color: colors.text,
    fontSize: 13,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  input: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(55,65,81,0.8)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    backgroundColor: "rgba(15,23,42,0.95)",
    fontSize: 13,
    marginRight: 8,
  },
  sendButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  sendText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
