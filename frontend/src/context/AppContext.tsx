import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import api from "../api/client";
import { useSpotifyPlayer } from "../spotify/useSpotifyPlayer";

type OnTrackEndedCallback = () => void;

type SpotifyState = {
  isReady: boolean;
  isConnecting: boolean;
  error: string | null;
};

type AppContextValue = {
  // Spotify state
  spotify: SpotifyState;
  // Spotify actions
  playSpotifyTrack: (url: string, offsetSeconds: number) => Promise<void>;
  stopSpotify: () => Promise<void>;
  setOnTrackEnded: (callback: OnTrackEndedCallback | null) => void;
  refreshSpotifyConnection: () => Promise<void>;
  connectSpotify: () => Promise<void>;
  // Other global states can be added here
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [spotifyState, setSpotifyState] = useState<SpotifyState>({
    isReady: false,
    isConnecting: false,
    error: null,
  });

  // Use the Spotify player hook
  const {
    isReady: spotifyReady,
    playSpotifyTrack: playTrack,
    stopSpotify: stopTrack,
    setOnTrackEnded: setTrackEnded,
    refreshConnection: refreshConnectionHook,
  } = useSpotifyPlayer();

  // Track Spotify connection state
  useEffect(() => {
    // Update state when Spotify player becomes ready
    setSpotifyState((prev) => ({
      ...prev,
      isReady: spotifyReady,
      error: spotifyReady ? null : prev.error,
    }));
  }, [spotifyReady]);

  // Check for Spotify OAuth callback on web
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const urlParams = new URLSearchParams(window.location.search);
    const spotifyStatus = urlParams.get("spotify");

    if (spotifyStatus === "connected") {
      // User just connected Spotify, refresh the connection
      refreshSpotifyConnection();
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("spotify");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, []);

  const refreshSpotifyConnection = useCallback(async () => {
    if (refreshConnectionHook) {
      setSpotifyState((prev) => ({ ...prev, isConnecting: true, error: null }));
      try {
        await refreshConnectionHook();
      } catch (e: any) {
        setSpotifyState((prev) => ({
          ...prev,
          error: e.message || "Failed to refresh Spotify connection",
        }));
      } finally {
        setSpotifyState((prev) => ({ ...prev, isConnecting: false }));
      }
    }
  }, [refreshConnectionHook]);

  const connectSpotify = useCallback(async () => {
    try {
      setSpotifyState((prev) => ({ ...prev, isConnecting: true, error: null }));
      const res = await api.post("/spotify/login-url");
      const { url } = res.data;
      if (Platform.OS === "web") {
        window.location.href = url;
      } else {
        // For native, we'd use WebBrowser here
        // This will be handled by the component calling this
      }
    } catch (e: any) {
      setSpotifyState((prev) => ({
        ...prev,
        error: e.message || "Failed to connect to Spotify",
        isConnecting: false,
      }));
    }
  }, []);

  const value: AppContextValue = {
    spotify: spotifyState,
    playSpotifyTrack: playTrack,
    stopSpotify: stopTrack,
    setOnTrackEnded: setTrackEnded,
    refreshSpotifyConnection,
    connectSpotify,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

