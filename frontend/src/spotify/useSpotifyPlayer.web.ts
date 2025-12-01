import { useEffect, useState, useCallback } from "react";
import api from "../api/client";

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: any;
  }
}

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

export function useSpotifyPlayer() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // 1) Fetch player token
  useEffect(() => {
    let cancelled = false;

    const fetchToken = async () => {
      try {
        const res = await api.get("/spotify/player-token");
        if (cancelled) return;
        setAccessToken(res.data.accessToken);
      } catch (e) {
        console.log("No Spotify token / not connected", e);
        setAccessToken(null);
        setIsReady(false);
      }
    };

    fetchToken();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Load SDK + init player when token is ready
  useEffect(() => {
    if (!accessToken) return;
    if (playerInstance) {
      // already initialized
      setIsReady(!!playerDeviceId);
      return;
    }

    const scriptId = "spotify-web-playback-sdk";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      document.body.appendChild(script);
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      const tokenGetter = (cb: (t: string) => void) => {
        if (accessToken) cb(accessToken);
      };

      const player = new window.Spotify.Player({
        name: "MoodMixer Web Player",
        getOAuthToken: tokenGetter,
        volume: 0.8,
      });

      player.addListener("ready", ({ device_id }: any) => {
        console.log("Spotify Player ready with device ID", device_id);
        playerDeviceId = device_id;
        setIsReady(true);
      });

      player.addListener("not_ready", ({ device_id }: any) => {
        console.log("Spotify Player not ready", device_id);
        if (playerDeviceId === device_id) {
          setIsReady(false);
          playerDeviceId = null;
        }
      });

      player.addListener("initialization_error", ({ message }: any) =>
        console.error(message)
      );
      player.addListener("authentication_error", ({ message }: any) =>
        console.error(message)
      );
      player.addListener("account_error", ({ message }: any) =>
        console.error(message)
      );
      player.addListener("playback_error", ({ message }: any) =>
        console.error(message)
      );

      player.connect();
      playerInstance = player;
    };
  }, [accessToken]);

  const playSpotifyTrack = useCallback(
    async (url: string, offsetSeconds: number) => {
      if (!accessToken || !isReady || !playerDeviceId) {
        console.log("Spotify player not ready");
        return;
      }

      const uri = extractSpotifyTrackUri(url);
      if (!uri) {
        console.log("Not a valid Spotify track URL", url);
        return;
      }

      try {
        await fetch(
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
      } catch (e) {
        console.log("Error starting Spotify playback", e);
      }
    },
    [accessToken, isReady]
  );

  return { isReady: !!accessToken && isReady, playSpotifyTrack };
}
