import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import GradientBackground from "../components/GradientBackground";
import PrimaryButton from "../components/PrimaryButton";
import { colors, radii, spacing } from "../theme";

export default function AuthScreen() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  // sound-wave bars
  const bars = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    // header + card entrance
    Animated.parallel([
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 600,
        delay: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // looping wave
    const createWave = (bar: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            toValue: 1,
            duration: 500,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );

    bars.forEach((bar, index) => {
      createWave(bar, index * 150).start();
    });
  }, []);

  const handleSubmit = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
    } catch (e: any) {
      console.log("Auth error", e);
      Alert.alert("Error", e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      setGoogleLoading(true);
      await signInWithGoogle();
    } catch (e: any) {
      console.log("Google sign-in error", e);
      Alert.alert("Error", e.message || "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  const headerStyle = {
    opacity: headerAnim,
    transform: [
      {
        translateY: headerAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
  };

  const cardStyle = {
    opacity: cardAnim,
    transform: [
      {
        translateY: cardAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [40, 0],
        }),
      },
    ],
  };

  const waveBarStyle = (val: Animated.Value) => ({
    transform: [
      {
        scaleY: val.interpolate({
          inputRange: [0, 1],
          outputRange: [0.5, 1.8],
        }),
      },
    ],
  });

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <Animated.View style={[styles.header, headerStyle]}>
            <Text style={styles.logo}>🎛 MoodMixer</Text>
            <Text style={styles.subtitle}>
              Curate the vibe. Share the mood.
            </Text>
          </Animated.View>

          {/* Centered sound-wave animation */}
          <View style={styles.waveWrapper}>
            {bars.map((b, i) => (
              <Animated.View
                key={i}
                style={[styles.waveBar, waveBarStyle(b)]}
              />
            ))}
          </View>

          <Animated.View style={[styles.card, cardStyle]}>
            <Text style={styles.cardTitle}>
              {mode === "login" ? "Welcome back" : "Create your account"}
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@vibes.fm"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <PrimaryButton
              title={mode === "login" ? "Sign in" : "Sign up"}
              onPress={handleSubmit}
              loading={loading}
            />

            <View style={{ height: spacing.md }} />

            <PrimaryButton
              title="Continue with Google"
              onPress={handleGoogle}
              loading={googleLoading}
              ghost
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>
                {mode === "login"
                  ? "New to MoodMixer?"
                  : "Already got a magical place?"}
              </Text>
              <Text
                style={styles.switchLink}
                onPress={() =>
                  setMode((prev) => (prev === "login" ? "register" : "login"))
                }
              >
                {mode === "login" ? "Create one" : "Sign in"}
              </Text>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: "stretch",
    justifyContent: "center", // center header + wave + card vertically
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  logo: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 14,
  },
  waveWrapper: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
    height: 60,
  },
  waveBar: {
    width: 6,
    height: 32,          // ⬅️ base height so scaleY has something to stretch
    borderRadius: 999,
    marginHorizontal: 4,
    backgroundColor: colors.accent,
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.9)",
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
    fontSize: 12,
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: "rgba(15,23,42,0.9)",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  switchText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  switchLink: {
    color: colors.accentSecondary,
    fontSize: 13,
    marginLeft: 4,
    fontWeight: "500",
  },
});
