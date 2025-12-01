import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { RoomThemeId, roomThemes } from "../../theme";
import { spacing, colors, radii } from "../../theme";

type Props = {
  value: RoomThemeId;
  onChange: (theme: RoomThemeId) => void;
};

const ORDER: RoomThemeId[] = ["synthwave", "chill", "sunset", "forest"];

export default function RoomThemePicker({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Room theme</Text>
        <Text style={styles.currentTheme}>
          {roomThemes[value].label}
        </Text>
      </View>
      <View style={styles.row}>
        {ORDER.map((id) => {
          const t = roomThemes[id];
          const selected = id === value;
          return (
            <TouchableOpacity
              key={id}
              style={[
                styles.chip,
                {
                  borderColor: selected ? t.accent : "rgba(148,163,184,0.5)",
                  backgroundColor: selected
                    ? "rgba(15,23,42,0.95)"
                    : "rgba(15,23,42,0.8)",
                },
              ]}
              onPress={() => onChange(id)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.colorDot,
                  { backgroundColor: t.accent },
                ]}
              />
              <Text
                style={[
                  styles.chipText,
                  selected && { color: t.accent },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
  },
  currentTheme: {
    color: colors.textMuted,
    fontSize: 12,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 6,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
