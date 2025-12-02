import { useEffect, useRef } from "react";
import { Platform, Alert } from "react-native";
import { Track, TrackMetadata } from "../api/rooms";

type Props = {
  nowPlayingTrack: Track | undefined;
  nowPlayingStartedAt: number | null;
  spotifyReady: boolean;
  playSpotifyTrack: (url: string, offsetSeconds: number) => Promise<void>;
};

/**
 * Hook to manage Spotify playback synchronization
 * Handles playing Spotify tracks when they're set as now playing
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

    if (!spotifyReady) {
      // Spotify not ready yet - store the pending playback so we can retry when ready
      if (nowPlayingTrack && nowPlayingTrack.id) {
        pendingPlaybackRef.current = {
          trackId: nowPlayingTrack.id,
          url: nowPlayingTrack.url,
          startedAt: nowPlayingStartedAt,
        };
      }
      // The effect will re-run when spotifyReady becomes true
      return;
    }

    // If we have pending playback and Spotify just became ready, prioritize playing it
    if (
      pendingPlaybackRef.current.trackId &&
      pendingPlaybackRef.current.url &&
      pendingPlaybackRef.current.trackId === nowPlayingTrack?.id
    ) {
      // Use pending playback data
      const pendingUrl = pendingPlaybackRef.current.url;
      const pendingStartedAt = pendingPlaybackRef.current.startedAt;

      // Clear pending
      pendingPlaybackRef.current = {
        trackId: null,
        url: null,
        startedAt: null,
      };

      // Check if we've already played this
      if (
        lastPlayedRef.current.trackId === nowPlayingTrack.id &&
        lastPlayedRef.current.startedAt === pendingStartedAt
      ) {
        return;
      }

      const playTrack = async () => {
        try {
          // Small delay to ensure Spotify player is fully ready
          await new Promise((resolve) => setTimeout(resolve, 100));

          lastPlayedRef.current = {
            trackId: nowPlayingTrack.id,
            startedAt: pendingStartedAt,
          };

          if (!pendingStartedAt) {
            await playSpotifyTrack(pendingUrl, 0);
          } else {
            const offsetSeconds = Math.max(
              0,
              (Date.now() - pendingStartedAt) / 1000
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
              startedAt: pendingStartedAt,
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

    // For Spotify tracks, wait for the startedAt timestamp to arrive
    // This prevents playing from 0 and then restarting when the timestamp arrives
    // The onNowPlayingState event will fire with the timestamp shortly after onNowPlayingChanged
    if (
      !nowPlayingStartedAt &&
      lastPlayedRef.current.trackId !== nowPlayingTrack.id
    ) {
      // Don't play yet - wait for the onNowPlayingState event to fire with startedAt
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

