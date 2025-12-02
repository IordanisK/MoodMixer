import React, { useMemo, useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

type Props = {
  url?: string;
  startedAt?: number | null; // ms since epoch
  onTrackEnded?: () => void;
};

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

let apiLoaded = false;
let apiReadyPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (apiLoaded && window.YT?.Player) {
    return Promise.resolve();
  }

  if (apiReadyPromise) {
    return apiReadyPromise;
  }

  apiReadyPromise = new Promise((resolve) => {
    // Check if YT API is already available
    if (window.YT?.Player) {
      apiLoaded = true;
      resolve();
      return;
    }

    // Set the callback
    window.onYouTubeIframeAPIReady = () => {
      console.log("✅ YouTube IFrame API ready");
      apiLoaded = true;
      resolve();
    };

    // Load the script if not already present
    if (!document.getElementById("youtube-iframe-api")) {
      const script = document.createElement("script");
      script.id = "youtube-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.body.appendChild(script);
    }
  });

  return apiReadyPromise;
}

export default function WebNowPlayingPlayer({ url, startedAt, onTrackEnded }: Props) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentVideoIdRef = useRef<string | null>(null);
  const onTrackEndedRef = useRef(onTrackEnded);

  // Keep onTrackEnded ref updated
  useEffect(() => {
    onTrackEndedRef.current = onTrackEnded;
  }, [onTrackEnded]);

  const videoId = url ? extractYouTubeId(url) : null;

  const offsetSeconds = useMemo(() => {
    if (!startedAt) return 0;
    const diffMs = Date.now() - startedAt;
    if (diffMs <= 0) return 0;
    return Math.floor(diffMs / 1000);
  }, [startedAt, url]);

  const handlePlayerStateChange = useCallback((event: any) => {
    // YT.PlayerState.ENDED === 0
    if (event.data === 0) {
      console.log("🎬 YouTube video ended!");
      if (onTrackEndedRef.current) {
        onTrackEndedRef.current();
      }
    }
  }, []);

  useEffect(() => {
    if (!videoId) {
      // Clean up player if no video
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
        currentVideoIdRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const initPlayer = async () => {
      await loadYouTubeAPI();
      if (cancelled) return;

      // Same video, just seek if needed
      if (playerRef.current && currentVideoIdRef.current === videoId) {
        try {
          const currentTime = playerRef.current.getCurrentTime();
          // Only seek if difference is more than 3 seconds
          if (Math.abs(currentTime - offsetSeconds) > 3) {
            playerRef.current.seekTo(offsetSeconds, true);
          }
        } catch (e) {
          console.log("Error seeking", e);
        }
        return;
      }

      // Different video or first load
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      if (!containerRef.current) return;

      // Create player container
      const playerId = `yt-player-${Date.now()}`;
      const playerDiv = document.createElement("div");
      playerDiv.id = playerId;
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(playerDiv);

      playerRef.current = new window.YT.Player(playerId, {
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          start: offsetSeconds,
          controls: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onStateChange: handlePlayerStateChange,
          onReady: (event: any) => {
            console.log("🎬 YouTube player ready, starting playback");
            event.target.playVideo();
          },
          onError: (event: any) => {
            console.error("🎬 YouTube player error:", event.data);
          },
        },
      });

      currentVideoIdRef.current = videoId;
    };

    initPlayer();

    return () => {
      cancelled = true;
    };
  }, [videoId, offsetSeconds, handlePlayerStateChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // Ignore cleanup errors
        }
        playerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    console.log("🎬 YouTube player updated:", {
      videoId,
      url,
      startedAt,
      offsetSeconds,
    });
  }, [videoId, url, startedAt, offsetSeconds]);

  if (!url || !videoId) return null;

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
      <div
        ref={containerRef}
        className="yt-player-container"
        style={{
          position: "relative",
          paddingTop: "56.25%",
        }}
      >
        {/* YouTube player will be injected here */}
      </div>
      <style>{`
        .yt-player-container > div {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }
        .yt-player-container iframe {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
    </div>
  );
}
