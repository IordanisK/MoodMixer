export const colors = {
  bg: "#050816",
  bgSoft: "#0b1220",
  card: "#111827",
  cardSoft: "#020617",
  accent: "#6366f1",
  accentSoft: "#4f46e5",
  accentSecondary: "#ec4899",
  text: "#e5e7eb",
  textMuted: "#9ca3af",
  border: "#1f2937",
  danger: "#f97373",
};

export const radii = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export type RoomThemeId = "synthwave" | "chill" | "sunset" | "forest";

export const roomThemes: Record<
  RoomThemeId,
  {
    label: string;
    accent: string;
    accentSoft: string;
    glow: string;
    bgGradient: string[];
  }
> = {
  synthwave: {
    label: "Synthwave",
    accent: "#ec4899",
    accentSoft: "rgba(236,72,153,0.6)",
    glow: "rgba(236,72,153,0.9)",
    bgGradient: ["#020617", "#0f172a", "#4c1d95"], // dark → purple
  },
  chill: {
    label: "Chill purple",
    accent: "#8b5cf6",
    accentSoft: "rgba(139,92,246,0.6)",
    glow: "rgba(139,92,246,0.9)",
    bgGradient: ["#020617", "#020617", "#1e293b"], // deep blue-ish
  },
  sunset: {
    label: "Sunset",
    accent: "#f97316",
    accentSoft: "rgba(249,115,22,0.6)",
    glow: "rgba(249,115,22,0.9)",
    bgGradient: ["#020617", "#1e293b", "#7c2d12"], // warm
  },
  forest: {
    label: "Forest",
    accent: "#22c55e",
    accentSoft: "rgba(34,197,94,0.6)",
    glow: "rgba(34,197,94,0.9)",
    bgGradient: ["#020617", "#022c22", "#064e3b"], // green
  },
};