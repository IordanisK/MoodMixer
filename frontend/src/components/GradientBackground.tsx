import React, { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { RoomThemeId, roomThemes } from "../theme";

type Props = {
  children: ReactNode;
  themeId?: RoomThemeId; // optional so other screens still work
};

export default function GradientBackground({ children, themeId }: Props) {
  const theme = themeId ? roomThemes[themeId] : null;

  const gradientColors: [string, string, string] = theme 
  ? (theme.bgGradient as [string, string, string])
  : ["#020617", "#020617", "#1e293b"];

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
