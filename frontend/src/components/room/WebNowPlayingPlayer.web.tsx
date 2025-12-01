import React, { useMemo } from "react";

type Props = {
  url?: string;
  startedAt?: number | null; // ms since epoch
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

export default function WebNowPlayingPlayer({ url, startedAt }: Props) {
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

  const src = `https://www.youtube.com/embed/${videoId}?autoplay=1&start=${offsetSeconds}&controls=1`;

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
          src={src}
          title="Now playing"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
          }}
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </div>
    </div>
  );
}
