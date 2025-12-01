import React, { useState } from "react";
import {
  View,
  TextInput,
  Button,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Text,
} from "react-native";
import { colors, radii, spacing } from "../theme";

const GIPHY_API_KEY = "YOUR_GIPHY_API_KEY_HERE";

type Props = {
  onSelect: (gifUrl: string) => void;
};

export default function GiphySearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    try {
      setLoading(true);
      const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(
        query
      )}&limit=15&rating=pg`;
      const res = await fetch(url);
      const json = await res.json();
      setResults(json.data || []);
    } catch (e) {
      console.log("Giphy search error", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ marginTop: spacing.sm }}>
      <TextInput
        style={styles.input}
        placeholder="Search mood GIFs (e.g. cozy, hype)"
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
      />
      <Button
        title={loading ? "Searching..." : "Search GIFs"}
        onPress={search}
      />
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: spacing.sm }}
        renderItem={({ item }) => {
          const gifUrl = item.images.fixed_height_small.url;
          return (
            <TouchableOpacity onPress={() => onSelect(gifUrl)}>
              <Image
                source={{ uri: gifUrl }}
                style={styles.gif}
              />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.cardSoft,
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  gif: {
    width: 110,
    height: 110,
    marginRight: 8,
    borderRadius: radii.md,
  },
});
