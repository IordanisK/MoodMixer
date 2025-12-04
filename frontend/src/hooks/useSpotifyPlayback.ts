import { useEffect, useRef } from "react";
import { Platform, Alert } from "react-native";
import { Track } from "../api/rooms";

type Props = {
  nowPlayingTrack: Track | undefined;
  nowPlayingStartedAt: number | null;
  spotifyReady: boolean;
  playSpotifyTrack: (url: string, offsetSeconds: number) => Promise<void>;
};

/**
 * Hook to manage Spotify playback synchronization
 * Handles playing Spotify tracks when they're set as now playing
 * 
 * IMPORTANT: Playback is independent per user:
 * - Users with Spotify connected play immediately when a track starts
 * - Users without Spotify connected see a warning and can connect anytime
 * - When a disconnected user connects later, they automatically sync to the current playback position
 */
export function useSpotifyPlayback({
  nowPlayingTrack,
  nowPlayingStartedAt,
  spotifyReady,
  playSpotifyTrack,
}: Props) {
  // Track the last played track to prevent duplicate playback
  const lastPlayedRef = useRef<{
    trackId: string | null;
    startedAt: number | null;
  }>({
    trackId: null,
    startedAt: null,
  });

  // Track pending playback that's waiting for Spotify to be ready
  const pendingPlaybackRef = useRef<{
    trackId: string | null;
    url: string | null;
    startedAt: number | null;
  }>({
    trackId: null,
    url: null,
    startedAt: null,
  });

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    // If we have a nowPlayingId but the track isn't in the tracks array yet,
    // wait for it to arrive (this can happen when a track is added and immediately set as now playing)
    if (!nowPlayingTrack) {
      // Reset last played when track is cleared
      lastPlayedRef.current = { trackId: null, startedAt: null };
      pendingPlaybackRef.current = {
        trackId: null,
        url: null,
        startedAt: null,
      };
      return;
    }

    if (
      nowPlayingTrack.provider !== "spotify" &&
      !(nowPlayingTrack.url && nowPlayingTrack.url.includes("spotify.com"))
    ) {
      return;
    }

    // Store pending playback if Spotify isn't ready yet
    // This ensures we can start playback when Spotify becomes ready
    // IMPORTANT: Each user's playback is independent - connected users play immediately,
    // disconnected users will play when they connect
    if (!spotifyReady) {
      if (nowPlayingTrack && nowPlayingTrack.id) {
        // Update pending playback with latest state (in case startedAt changes)
        // Always use the latest startedAt to ensure we sync to current position when connecting
        pendingPlaybackRef.current = {
          trackId: nowPlayingTrack.id,
          url: nowPlayingTrack.url,
          startedAt: nowPlayingStartedAt, // This will be used to calculate offset when connecting
        };
      }
      // The effect will re-run when spotifyReady becomes true
      return;
    }

    // If we have pending playback and Spotify just became ready, prioritize playing it
    // This handles the case where a user connects to Spotify while a track is already playing
    if (
      pendingPlaybackRef.current.trackId &&
      pendingPlaybackRef.current.url &&
      pendingPlaybackRef.current.trackId === nowPlayingTrack?.id
    ) {
      // Use pending playback data, but prefer current startedAt if available (more accurate)
      const pendingUrl = pendingPlaybackRef.current.url;
      // Use the most recent startedAt - either from pending or current state
      const startedAtToUse = nowPlayingStartedAt ?? pendingPlaybackRef.current.startedAt;

      // Clear pending
      pendingPlaybackRef.current = {
        trackId: null,
        url: null,
        startedAt: null,
      };

      // Check if we've already played this exact combination
      if (
        lastPlayedRef.current.trackId === nowPlayingTrack.id &&
        lastPlayedRef.current.startedAt === startedAtToUse
      ) {
        return;
      }

      const playTrack = async () => {
        try {
          // Small delay to ensure Spotify player is fully ready
          await new Promise((resolve) => setTimeout(resolve, 100));

          lastPlayedRef.current = {
            trackId: nowPlayingTrack.id,
            startedAt: startedAtToUse,
          };

          if (!startedAtToUse) {
            await playSpotifyTrack(pendingUrl, 0);
          } else {
            // Calculate offset based on how long the track has been playing
            // This ensures users connecting later sync to the current position
            const offsetSeconds = Math.max(
              0,
              (Date.now() - startedAtToUse) / 1000
            );
            await playSpotifyTrack(pendingUrl, offsetSeconds);
          }
        } catch (e: any) {
          console.error("Error playing pending Spotify track:", e);
          // If still not ready, restore pending
          const errorMessage = e.message || "";
          if (errorMessage.includes("Spotify player not ready")) {
            pendingPlaybackRef.current = {
              trackId: nowPlayingTrack.id,
              url: pendingUrl,
              startedAt: startedAtToUse,
            };
          }
          lastPlayedRef.current = { trackId: null, startedAt: null };
        }
      };

      playTrack();
      return;
    }

    // Check if we've already played this exact track with this exact startedAt
    // This prevents duplicate playback when the effect runs multiple times
    if (
      lastPlayedRef.current.trackId === nowPlayingTrack.id &&
      lastPlayedRef.current.startedAt === nowPlayingStartedAt
    ) {
      return;
    }

    // For Spotify tracks, wait for the startedAt timestamp to arrive if we don't have it yet
    // This prevents playing from 0 and then restarting when the timestamp arrives
    // However, if we already have a startedAt (e.g., from loadRoom when joining), we can proceed
    if (
      !nowPlayingStartedAt &&
      lastPlayedRef.current.trackId !== nowPlayingTrack.id
    ) {
      // Don't play yet - wait for the onNowPlayingState event to fire with startedAt
      // But store as pending so we can play when timestamp arrives
      pendingPlaybackRef.current = {
        trackId: nowPlayingTrack.id,
        url: nowPlayingTrack.url,
        startedAt: null,
      };
      return;
    }

    const playTrack = async () => {
      try {
        // Small delay to ensure Spotify player is fully ready
        // This helps when a track is added and immediately set as now playing
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Update last played ref immediately to prevent duplicate calls
        lastPlayedRef.current = {
          trackId: nowPlayingTrack.id,
          startedAt: nowPlayingStartedAt,
        };

        if (!nowPlayingStartedAt) {
          // fallback: start from 0 if we don't have a timestamp
          await playSpotifyTrack(nowPlayingTrack.url, 0);
        } else {
          // Calculate offset based on how long the track has been playing
          // This ensures users joining mid-track start at the correct position
          const offsetSeconds = Math.max(
            0,
            (Date.now() - nowPlayingStartedAt) / 1000
          );
          await playSpotifyTrack(nowPlayingTrack.url, offsetSeconds);
        }
      } catch (e: any) {
        console.error("Error playing Spotify track:", e);
        const errorMessage = e.message || "Failed to play Spotify track";

        // If the error is because Spotify isn't ready, store as pending and retry when ready
        if (errorMessage.includes("Spotify player not ready")) {
          pendingPlaybackRef.current = {
            trackId: nowPlayingTrack.id,
            url: nowPlayingTrack.url,
            startedAt: nowPlayingStartedAt,
          };
          // Reset lastPlayedRef so we can retry
          lastPlayedRef.current = { trackId: null, startedAt: null };
          // Don't show error - will retry automatically when ready
          return;
        }

        // Reset last played on other errors so we can retry
        lastPlayedRef.current = { trackId: null, startedAt: null };

        // Show user-friendly error message for non-ready errors
        if (Platform.OS === "web") {
          alert(`Spotify Playback Error\n\n${errorMessage}`);
        } else {
          Alert.alert("Spotify Playback Error", errorMessage);
        }
      }
    };

    playTrack();
  }, [
    nowPlayingTrack?.id,
    nowPlayingTrack?.url,
    nowPlayingStartedAt,
    spotifyReady,
    playSpotifyTrack,
  ]);
}

