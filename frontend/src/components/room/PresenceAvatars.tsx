import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "../../theme";

type Props = {
  count: number;
};

const AVATAR_COLORS = [
  "#f97316", // orange
  "#22c55e", // green
  "#3b82f6", // blue
  "#ec4899", // pink
  "#8b5cf6", // purple
];

const MAX_VISIBLE = 5;

export default function PresenceAvatars({ count }: Props) {
  if (count <= 0) return null;

  const visible = Math.min(count, MAX_VISIBLE);
  const extra = count - visible;

  return (
    <View style={styles.container}>
      <View style={styles.avatarsRow}>
        {Array.from({ length: visible }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.avatar,
              {
                backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
                marginLeft: i === 0 ? 0 : -10,
              },
            ]}
          >
            <Text style={styles.avatarText}>DJ</Text>
          </View>
        ))}
        {extra > 0 && (
          <View style={[styles.avatar, styles.extraAvatar]}>
            <Text style={styles.avatarText}>+{extra}</Text>
          </View>
        )}
      </View>
      <Text style={styles.label}>
        {count} {count === 1 ? "DJ" : "DJs"} live
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#020617", // match dark bg
  },
  extraAvatar: {
    backgroundColor: "rgba(15,23,42,0.95)",
    marginLeft: -10,
  },
  avatarText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "600",
  },
  label: {
    marginLeft: spacing.xs,
    color: colors.textMuted,
    fontSize: 11,
  },
});
