import React, { useMemo, useEffect, useRef, useState } from "react";

type Props = {
  url?: string;
  startedAt?: number | null; // ms since epoch
};

// Declare YouTube IFrame API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (
      u.hostname.includes("youtube.com") ||
      u.hostname.includes("youtu.be")
    ) {
      if (u.hostname.includes("youtu.be")) {
        // short link: https://youtu.be/<id>
        return u.pathname.replace("/", "") || null;
      }
      // regular: https://www.youtube.com/watch?v=<id>
      const v = u.searchParams.get("v");
      return v || null;
    }
    return null;
  } catch {
    return null;
  }
}

export default function WebNowPlayingPlayer({ url, startedAt }: Props) {
  const [playerReady, setPlayerReady] = useState(false);
  const playerRef = useRef<any>(null);
  const containerId = useRef(`youtube-player-${Math.random().toString(36).substr(2, 9)}`);

  if (!url) return null;

  const videoId = extractYouTubeId(url);
  if (!videoId) {
    // For now we only support YouTube links in the synced web player
    return null;
  }

  const offsetSeconds = useMemo(() => {
    if (!startedAt) return 0;
    const diffMs = Date.now() - startedAt;
    if (diffMs <= 0) return 0;
    return Math.floor(diffMs / 1000);
  }, [startedAt, url]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (typeof window === "undefined" || window.YT) {
      setPlayerReady(true);
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      setPlayerReady(true);
    };

    return () => {
      // Cleanup
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    };
  }, []);

  // Initialize player when API is ready
  useEffect(() => {
    if (!playerReady || !window.YT || !videoId) return;

    const container = document.getElementById(containerId.current);
    if (!container) return;

    // Destroy existing player if it exists
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {
        // Ignore errors
      }
    }

    // Create new player
    playerRef.current = new window.YT.Player(containerId.current, {
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        start: offsetSeconds,
        controls: 1,
        enablejsapi: 1,
        modestbranding: 1,
      },
      events: {
        onReady: (event: any) => {
          console.log("🎬 YouTube player ready, starting playback at", offsetSeconds, "seconds");
          // Ensure video plays and seeks to correct position
          event.target.seekTo(offsetSeconds, true);
          event.target.playVideo();
        },
        onStateChange: (event: any) => {
          // YouTube player states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
          if (event.data === window.YT.PlayerState.PLAYING) {
            console.log("🎬 YouTube player is playing");
          }
        },
      },
    });

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // Ignore errors during cleanup
        }
        playerRef.current = null;
      }
    };
  }, [playerReady, videoId, offsetSeconds]);

  // Update player when offset changes (for sync)
  useEffect(() => {
    if (!playerRef.current || !playerReady) return;

    const currentTime = playerRef.current.getCurrentTime();
    const targetTime = offsetSeconds;
    const diff = Math.abs(currentTime - targetTime);

    // If we're more than 2 seconds off, seek to correct position
    if (diff > 2) {
      console.log("🎬 Syncing YouTube player:", { currentTime, targetTime, diff });
      try {
        playerRef.current.seekTo(targetTime, true);
        // Ensure it's playing
        if (playerRef.current.getPlayerState() !== window.YT.PlayerState.PLAYING) {
          playerRef.current.playVideo();
        }
      } catch (e) {
        console.error("Error syncing YouTube player:", e);
      }
    }
  }, [offsetSeconds, playerReady]);

  useEffect(() => {
    console.log("🎬 YouTube player updated:", {
      videoId,
      url,
      startedAt,
      offsetSeconds,
      playerReady,
    });
  }, [videoId, url, startedAt, offsetSeconds, playerReady]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 720,
        margin: "0 auto 16px auto",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 18px 45px rgba(15,23,42,0.85)",
        border: "1px solid rgba(148,163,184,0.3)",
      }}
    >
      <div style={{ position: "relative", paddingTop: "56.25%" }}>
        <div
          id={containerId.current}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
          }}
        />
      </div>
    </div>
  );
}
