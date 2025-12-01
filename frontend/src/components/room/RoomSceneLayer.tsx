import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { RoomThemeId, roomThemes } from "../../theme";

type Props = {
  themeId: RoomThemeId;
};

export default function RoomSceneLayer({ themeId }: Props) {
  const theme = roomThemes[themeId] || roomThemes.synthwave;

  // three animated blobs
  const blob1 = useRef(new Animated.Value(0)).current;
  const blob2 = useRef(new Animated.Value(0)).current;
  const blob3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeLoop = (anim: Animated.Value, delay: number) => {
      anim.setValue(0);
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 9000,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 9000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    makeLoop(blob1, 0);
    makeLoop(blob2, 1500);
    makeLoop(blob3, 3000);

    return () => {
      blob1.stopAnimation();
      blob2.stopAnimation();
      blob3.stopAnimation();
    };
  }, [themeId]);

  const makeStyle = (anim: Animated.Value, xFrom: number, xTo: number) => ({
    transform: [
      {
        translateX: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [xFrom, xTo],
        }),
      },
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [40, -20],
        }),
      },
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.2],
        }),
      },
    ],
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.18, 0.35],
    }),
    backgroundColor: theme.glow,
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[styles.blob, makeStyle(blob1, -40, 40)]}
      />
      <Animated.View
        style={[styles.blob, makeStyle(blob2, 100, -20)]}
      />
      <Animated.View
        style={[styles.blob, makeStyle(blob3, -80, 0)]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    top: -40,
    left: -40,
  },
});
