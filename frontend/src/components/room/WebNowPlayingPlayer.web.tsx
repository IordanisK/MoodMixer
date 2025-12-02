import React, { useMemo, useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

type Props = {
  url?: string;
  startedAt?: number | null;
  onTrackEnded?: () => void;
  onPlayerReady?: (controls: { stop: () => void }) => void;
};

function extractYouTubeId(url: string): string | null {
  if (!url) return null;

  try {
    // Add protocol if missing
    let fullUrl = url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      fullUrl = "https://" + url;
    }

    const u = new URL(fullUrl);

    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      if (u.hostname.includes("youtu.be")) {
        return u.pathname.replace("/", "").split("?")[0] || null;
      }
      const v = u.searchParams.get("v");
      return v || null;
    }
    return null;
  } catch (e) {
    // Fallback: try regex extraction
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /[?&]v=([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }
}

// Global YouTube API state
let ytApiLoaded = false;
let ytApiLoading = false;
let ytApiCallbacks: (() => void)[] = [];

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (ytApiLoaded && window.YT?.Player) {
      resolve();
      return;
    }

    ytApiCallbacks.push(resolve);

    if (ytApiLoading) return;
    ytApiLoading = true;

    window.onYouTubeIframeAPIReady = () => {
      ytApiLoaded = true;
      ytApiCallbacks.forEach((cb) => cb());
      ytApiCallbacks = [];
    };

    if (!document.getElementById("youtube-iframe-api")) {
      const script = document.createElement("script");
      script.id = "youtube-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

export default function WebNowPlayingPlayer({
  url,
  startedAt,
  onTrackEnded,
  onPlayerReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const onTrackEndedRef = useRef(onTrackEnded);
  const onPlayerReadyRef = useRef(onPlayerReady);
  const currentVideoIdRef = useRef<string | null>(null);
  const isInitializingRef = useRef(false);

  // Keep callback refs updated
  useEffect(() => {
    onTrackEndedRef.current = onTrackEnded;
  }, [onTrackEnded]);

  useEffect(() => {
    onPlayerReadyRef.current = onPlayerReady;
  }, [onPlayerReady]);

  // Expose stop function
  const stopYouTube = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.stopVideo();
      } catch (e) {
        // Error stopping YouTube
      }
    }
  }, []);

  // Notify parent when player controls are available
  useEffect(() => {
    if (onPlayerReadyRef.current) {
      onPlayerReadyRef.current({ stop: stopYouTube });
    }
  }, [stopYouTube]);

  const videoId = url ? extractYouTubeId(url) : null;

  const offsetSeconds = useMemo(() => {
    if (!startedAt) return 0;
    const diffMs = Date.now() - startedAt;
    if (diffMs <= 0) return 0;
    return Math.floor(diffMs / 1000);
  }, [startedAt]);

  // Handle player state changes
  const handleStateChange = useCallback((event: any) => {
    // YT.PlayerState.ENDED = 0
    if (event.data === 0) {
      console.log("🎬 YouTube video ended!");
      if (onTrackEndedRef.current) {
        onTrackEndedRef.current();
      }
    }
  }, []);

  // Initialize or update player
  useEffect(() => {
    if (!videoId) {
      // Cleanup if no video
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
        currentVideoIdRef.current = null;
      }
      return;
    }

    // Don't re-init if same video
    if (currentVideoIdRef.current === videoId && playerRef.current) {
      // Just seek if needed
      try {
        const currentTime = playerRef.current.getCurrentTime?.() || 0;
        if (Math.abs(currentTime - offsetSeconds) > 5) {
          playerRef.current.seekTo(offsetSeconds, true);
        }
      } catch (e) {}
      return;
    }

    // Prevent concurrent initialization
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    const initPlayer = async () => {
      await loadYouTubeAPI();

      if (!containerRef.current) {
        isInitializingRef.current = false;
        return;
      }

      // Destroy existing player
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }

      // Create container for player
      const playerId = `yt-player-${Date.now()}`;
      containerRef.current.innerHTML = `<div id="${playerId}"></div>`;

      // Create new player
      playerRef.current = new window.YT.Player(playerId, {
        videoId: videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          start: offsetSeconds,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            event.target.playVideo();
          },
          onStateChange: handleStateChange,
          onError: (event: any) => {
            console.error("YouTube player error:", event.data);
          },
        },
      });

      currentVideoIdRef.current = videoId;
      isInitializingRef.current = false;
    };

    initPlayer();
  }, [videoId, offsetSeconds, handleStateChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
    };
  }, []);

  if (!url || !videoId) return null;

  return (
    <div
      style={{
        width: "100%",
        marginBottom: 16,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 18px 45px rgba(15,23,42,0.85)",
        border: "1px solid rgba(148,163,184,0.3)",
      }}
    >
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          backgroundColor: "#000",
        }}
      >
        {/* YouTube player will be injected here */}
      </div>
      <style>{`
        #${containerRef.current?.firstElementChild?.id || "yt-player"} {
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
