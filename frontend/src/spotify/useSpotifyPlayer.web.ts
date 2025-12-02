import { useEffect, useState, useCallback, useRef } from "react";
import api from "../api/client";

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: any;
  }
}

type OnTrackEndedCallback = () => void;

function extractSpotifyTrackUri(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("spotify.com")) return null;
    const parts = u.pathname.split("/");
    const idx = parts.indexOf("track");
    if (idx === -1 || !parts[idx + 1]) return null;
    const id = parts[idx + 1].split("?")[0];
    return `spotify:track:${id}`;
  } catch {
    return null;
  }
}

let playerInstance: any = null;
let playerDeviceId: string | null = null;
let onTrackEndedCallback: OnTrackEndedCallback | null = null;
let lastPlayingUri: string | null = null;
let wasPlaying = false;

export function useSpotifyPlayer(shouldInit: boolean = true) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const onTrackEndedRef = useRef<OnTrackEndedCallback | null>(null);

  // Function to refresh the token (can be called externally)
  const refreshToken = useCallback(async () => {
    if (!shouldInit) return;
    try {
      const res = await api.get("/spotify/player-token");
      setAccessToken(res.data.accessToken);
    } catch (e: any) {
      // 401 is expected when Spotify isn't connected - don't log as error
      if (e.response?.status !== 401) {
        console.error("Error refreshing Spotify token:", e);
      }
      setAccessToken(null);
      setIsReady(false);
    }
  }, [shouldInit]);

  // 1) Fetch player token (only if shouldInit is true)
  useEffect(() => {
    if (!shouldInit) {
      setAccessToken(null);
      setIsReady(false);
      return;
    }

    let cancelled = false;

    const fetchToken = async () => {
      try {
        const res = await api.get("/spotify/player-token");
        if (cancelled) return;
        setAccessToken(res.data.accessToken);
      } catch (e: any) {
        // 401 is expected when Spotify isn't connected - don't log as error
        if (e.response?.status !== 401) {
          console.error("Error fetching Spotify token:", e);
        }
        setAccessToken(null);
        setIsReady(false);
      }
    };

    fetchToken();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger, shouldInit]); // Re-fetch when refreshTrigger changes or shouldInit changes

  // Check for Spotify OAuth callback on web
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check URL params for Spotify connection status
    const urlParams = new URLSearchParams(window.location.search);
    const spotifyStatus = urlParams.get("spotify");

    if (spotifyStatus === "connected") {
      // User just connected Spotify, refresh the token
      setRefreshTrigger((prev) => prev + 1);
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("spotify");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, []);

  // 2) Load SDK + init player when token is ready
  useEffect(() => {
    if (!accessToken) {
      return;
    }

    if (playerInstance) {
      // already initialized - check if device ID is available
      if (playerDeviceId) {
        setIsReady(true);
      } else {
        // Player exists but device ID not set yet - wait for ready event
        setIsReady(false);
      }
      return;
    }

    const initPlayer = () => {
      if (!window.Spotify) {
        console.error("Spotify SDK not available");
        return;
      }

      const tokenGetter = (cb: (t: string) => void) => {
        if (accessToken) {
          cb(accessToken);
        } else {
          console.error("No access token available for Spotify player");
        }
      };

      const player = new window.Spotify.Player({
        name: "MoodMixer Web Player",
        getOAuthToken: tokenGetter,
        volume: 0.8,
      });

      player.addListener("ready", ({ device_id }: any) => {
        playerDeviceId = device_id;
        setIsReady(true);
      });

      player.addListener("not_ready", ({ device_id }: any) => {
        if (playerDeviceId === device_id) {
          setIsReady(false);
          playerDeviceId = null;
        }
      });

      player.addListener("initialization_error", ({ message }: any) => {
        console.error("❌ Spotify initialization error:", message);
      });
      player.addListener("authentication_error", ({ message }: any) => {
        console.error("❌ Spotify authentication error:", message);
      });
      player.addListener("account_error", ({ message }: any) => {
        console.error("❌ Spotify account error:", message);
      });
      player.addListener("playback_error", ({ message }: any) => {
        console.error("❌ Spotify playback error:", message);
      });

      // Listen for track end
      player.addListener("player_state_changed", (state: any) => {
        if (!state) return;

        const currentUri = state.track_window?.current_track?.uri;
        const isPlaying = !state.paused;
        const position = state.position;
        const duration = state.duration;

        // Detect track end: was playing, now paused, position is at or near the end
        if (wasPlaying && state.paused && position === 0 && lastPlayingUri) {
          // Track ended and Spotify auto-advanced to beginning (no next track)
          console.log("🎵 Spotify track ended (detected pause at position 0)");
          if (onTrackEndedCallback) {
            onTrackEndedCallback();
          }
        }

        // Update tracking variables
        wasPlaying = isPlaying;
        if (currentUri) {
          lastPlayingUri = currentUri;
        }
      });

      player.connect();
      playerInstance = player;
    };

    // Check if SDK is already loaded
    if (window.Spotify) {
      initPlayer();
      return;
    }

    // SDK not loaded yet, set up callback and load script
    const scriptId = "spotify-web-playback-sdk";
    if (document.getElementById(scriptId)) {
      // Script is loading, wait for it
      window.onSpotifyWebPlaybackSDKReady = initPlayer;
    } else {
      // Load the script
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      script.onerror = () => {
        console.error("Failed to load Spotify SDK script");
      };
      document.body.appendChild(script);
      window.onSpotifyWebPlaybackSDKReady = initPlayer;
    }
  }, [accessToken]);

  const playSpotifyTrack = useCallback(
    async (url: string, offsetSeconds: number) => {
      if (!accessToken || !isReady || !playerDeviceId || !playerInstance) {
        // Throw error so caller knows the player isn't ready
        throw new Error(
          `Spotify player not ready: accessToken=${!!accessToken}, isReady=${isReady}, deviceId=${!!playerDeviceId}, instance=${!!playerInstance}`
        );
      }

      const uri = extractSpotifyTrackUri(url);
      if (!uri) {
        return;
      }

      try {
        // First, check current device and transfer to Web Playback SDK if needed
        const getPlayerResponse = await fetch(
          `https://api.spotify.com/v1/me/player`,
          {
            method: "GET",
            headers: {
              Authorization: "Bearer " + accessToken,
            },
          }
        );

        let needsTransfer = true;
        if (getPlayerResponse.ok) {
          // Check if response has content before parsing
          const contentType = getPlayerResponse.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            try {
              const playerData = await getPlayerResponse.json();
              if (
                playerData.device &&
                playerData.device.id === playerDeviceId
              ) {
                needsTransfer = false;
              }
            } catch (e) {
              // Will transfer anyway
            }
          } else if (getPlayerResponse.status === 204) {
            // 204 No Content - no active player, need to transfer
          }
        }

        // Transfer playback to Web Playback SDK device if needed
        if (needsTransfer) {
          const transferResponse = await fetch(
            `https://api.spotify.com/v1/me/player`,
            {
              method: "PUT",
              headers: {
                Authorization: "Bearer " + accessToken,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                device_ids: [playerDeviceId],
                play: false, // Don't start playing yet, just transfer
              }),
            }
          );

          if (!transferResponse.ok && transferResponse.status !== 204) {
            let errorText = "";
            try {
              errorText = await transferResponse.text();
            } catch (e) {
              // Could not read error response
            }

            // If 403, the user may not be registered in Spotify Developer Dashboard
            if (transferResponse.status === 403) {
              const errorMessage =
                errorText && errorText.includes("not be registered")
                  ? "Your Spotify account needs to be added to the app's allowed users. Please contact the app administrator or check developer.spotify.com/dashboard"
                  : "Access denied. Please check your Spotify account settings.";
              throw new Error(errorMessage);
            }

            // For other errors, continue anyway - might work if device is already active
          } else {
            // Small delay to ensure device transfer completes
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }

        // Now play the track on the Web Playback SDK device
        const playResponse = await fetch(
          `https://api.spotify.com/v1/me/player/play?device_id=${playerDeviceId}`,
          {
            method: "PUT",
            headers: {
              Authorization: "Bearer " + accessToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              uris: [uri],
              position_ms: Math.max(0, Math.floor(offsetSeconds * 1000)),
            }),
          }
        );

        // Spotify API returns 204 No Content on success for PUT requests
        if (!playResponse.ok && playResponse.status !== 204) {
          let errorText = "";
          try {
            errorText = await playResponse.text();
          } catch (e) {
            // Could not read error response
          }

          // Provide more helpful error messages
          if (playResponse.status === 403) {
            const errorMessage =
              errorText && errorText.includes("not be registered")
                ? "Your Spotify account needs to be added to the app's allowed users. Please contact the app administrator or check developer.spotify.com/dashboard"
                : "Access denied. Please check your Spotify account settings.";
            throw new Error(errorMessage);
          } else if (playResponse.status === 404) {
            throw new Error(
              "No active device found. Please make sure Spotify Web Playback SDK is connected."
            );
          } else {
            throw new Error(
              `Failed to play track: ${
                playResponse.statusText || "Unknown error"
              }`
            );
          }
        }
      } catch (e) {
        console.error("Error starting Spotify playback", e);
        throw e;
      }
    },
    [accessToken, isReady, playerDeviceId]
  );

  const setOnTrackEnded = useCallback(
    (callback: OnTrackEndedCallback | null) => {
      onTrackEndedRef.current = callback;
      onTrackEndedCallback = callback;
    },
    []
  );

  const stopSpotify = useCallback(async () => {
    if (!accessToken || !playerDeviceId) {
      return;
    }

    try {
      // Pause playback via Spotify API
      await fetch(
        `https://api.spotify.com/v1/me/player/pause?device_id=${playerDeviceId}`,
        {
          method: "PUT",
          headers: {
            Authorization: "Bearer " + accessToken,
          },
        }
      );
    } catch (e) {
      console.error("Error stopping Spotify playback:", e);
    }
  }, [accessToken, playerDeviceId]);

  // isReady should be true only when we have token, player instance, and device ID
  const actuallyReady =
    !!accessToken && isReady && !!playerDeviceId && !!playerInstance;

  return {
    isReady: actuallyReady,
    playSpotifyTrack,
    setOnTrackEnded,
    stopSpotify,
    refreshConnection: refreshToken, // Expose refresh function
  };
}
