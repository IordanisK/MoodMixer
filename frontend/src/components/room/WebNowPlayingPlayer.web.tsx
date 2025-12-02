import React, { useMemo, useEffect, useRef } from "react";

type Props = {
  url?: string;
  startedAt?: number | null;
  onTrackEnded?: () => void;
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
        // Short link: https://youtu.be/<id>
        return u.pathname.replace("/", "").split("?")[0] || null;
      }
      // Regular: https://www.youtube.com/watch?v=<id>
      const v = u.searchParams.get("v");
      return v || null;
    }
    return null;
  } catch (e) {
    console.log("Error extracting YouTube ID:", e, "from URL:", url);
    
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

export default function WebNowPlayingPlayer({ url, startedAt, onTrackEnded }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onTrackEndedRef = useRef(onTrackEnded);
  const lastVideoIdRef = useRef<string | null>(null);

  useEffect(() => {
    onTrackEndedRef.current = onTrackEnded;
  }, [onTrackEnded]);

  const videoId = url ? extractYouTubeId(url) : null;

  const offsetSeconds = useMemo(() => {
    if (!startedAt) return 0;
    const diffMs = Date.now() - startedAt;
    if (diffMs <= 0) return 0;
    return Math.floor(diffMs / 1000);
  }, [startedAt]);

  // Listen for YouTube postMessage events to detect video end
  useEffect(() => {
    if (!videoId) return;

    const handleMessage = (event: MessageEvent) => {
      // YouTube sends messages from youtube.com
      if (!event.origin.includes("youtube.com")) return;
      
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        
        // YouTube player state: 0 = ended
        if (data.event === "onStateChange" && data.info === 0) {
          console.log("🎬 YouTube video ended (via postMessage)");
          if (onTrackEndedRef.current) {
            onTrackEndedRef.current();
          }
        }
      } catch {
        // Not a JSON message, ignore
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [videoId]);

  useEffect(() => {
    console.log("🎬 YouTube player:", { videoId, url, startedAt, offsetSeconds });
  }, [videoId, url, startedAt, offsetSeconds]);

  if (!url || !videoId) return null;

  // Build YouTube embed URL with enablejsapi for postMessage communication
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&start=${offsetSeconds}&controls=1&enablejsapi=1&modestbranding=1&rel=0&origin=${encodeURIComponent(window.location.origin)}`;

  // Force iframe reload when video changes
  const key = `${videoId}-${lastVideoIdRef.current !== videoId ? Date.now() : 'stable'}`;
  if (lastVideoIdRef.current !== videoId) {
    lastVideoIdRef.current = videoId;
  }

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
        <iframe
          key={key}
          ref={iframeRef}
          src={embedUrl}
          title="Now playing"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            border: "none",
          }}
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
        />
      </div>
    </div>
  );
}
