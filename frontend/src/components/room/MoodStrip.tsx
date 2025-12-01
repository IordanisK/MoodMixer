import React from "react";
import { View, Text, FlatList, Image, StyleSheet } from "react-native";
import { MoodItem } from "../../api/rooms";
import { colors, radii, spacing } from "../../theme";
import GiphySearch from "../GiphySearch";

type Props = {
  items: MoodItem[];
  loading: boolean;
  onSelectGif: (url: string) => void | Promise<void>;
};

export default function MoodStrip({ items, loading, onSelectGif }: Props) {
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>
          Room mood {loading ? "(loading...)" : ""}
        </Text>
        <Text style={styles.subtitle}>
          GIFs & visuals that match the vibe.
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: spacing.sm }}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              No mood yet. Pick a GIF to set the scene ✨
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.moodItemCard}>
            <Image source={{ uri: item.url }} style={styles.moodImage} />
          </View>
        )}
      />

      <GiphySearch onSelect={onSelectGif} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.xs,
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
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  moodItemCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: 2,
    marginRight: 6,
    borderWidth: 1,
    borderColor: "rgba(55,65,81,0.7)",
  },
  moodImage: {
    width: 110,
    height: 110,
    borderRadius: radii.md,
  },
});
