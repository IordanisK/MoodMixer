import { useEffect, useState, useCallback, useRef } from "react";

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

let playerInstance: any = null;
let apiReady = false;

export function useYouTubePlayer() {
  const [isReady, setIsReady] = useState(false);
  const [playerInitialized, setPlayerInitialized] = useState(false);
  const playerRef = useRef<any>(null);
  const containerIdRef = useRef(`youtube-audio-player-${Math.random().toString(36).substr(2, 9)}`);

  // Load YouTube IFrame API
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.YT && window.YT.Player) {
      apiReady = true;
      setIsReady(true);
      return;
    }

    if (apiReady) {
      setIsReady(true);
      return;
    }

    // Check if script is already loading
    if (document.getElementById("youtube-iframe-api")) {
      // Wait for it to load
      const checkReady = setInterval(() => {
        if (window.YT && window.YT.Player) {
          apiReady = true;
          setIsReady(true);
          clearInterval(checkReady);
        }
      }, 100);
      return () => clearInterval(checkReady);
    }

    // Load the script
    const tag = document.createElement("script");
    tag.id = "youtube-iframe-api";
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      apiReady = true;
      setIsReady(true);
    };
  }, []);

  // Initialize hidden player when API is ready
  useEffect(() => {
    if (!isReady || !window.YT || playerRef.current) return;

    // Create a hidden container for the player
    let container = document.getElementById(containerIdRef.current);
    if (!container) {
      container = document.createElement("div");
      container.id = containerIdRef.current;
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.width = "1px";
      container.style.height = "1px";
      container.style.opacity = "0";
      container.style.pointerEvents = "none";
      document.body.appendChild(container);
    }

    // Create player instance
    try {
      const player = new window.YT.Player(containerIdRef.current, {
        width: 1,
        height: 1,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          fs: 0, // no fullscreen
          iv_load_policy: 3, // hide annotations
          modestbranding: 1,
          playsinline: 1,
          rel: 0, // don't show related videos
          mute: 0, // ensure not muted
        },
        events: {
          onReady: () => {
            console.log("✅ YouTube audio player ready");
            setPlayerInitialized(true);
          },
          onStateChange: (event: any) => {
            const player = playerRef.current || playerInstance;
            if (event.data === window.YT.PlayerState.PLAYING) {
              console.log("🎵 YouTube audio is playing");
              // Ensure volume is set and unmuted when playing starts
              try {
                if (player) {
                  player.setVolume(100);
                  player.unMute(); // Ensure not muted
                }
              } catch (e) {
                console.error("Error setting volume/unmuting:", e);
              }
            } else if (event.data === window.YT.PlayerState.ENDED) {
              console.log("🎵 YouTube audio ended");
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              console.log("🎵 YouTube audio paused");
            } else if (event.data === window.YT.PlayerState.BUFFERING) {
              console.log("🎵 YouTube audio buffering");
            }
          },
          onError: (event: any) => {
            console.error("❌ YouTube player error:", event.data);
          },
        },
      });
      playerInstance = player;
      playerRef.current = player;
    } catch (e) {
      console.error("Error creating YouTube player:", e);
    }

    return () => {
      // Cleanup on unmount
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // Ignore cleanup errors
        }
        playerRef.current = null;
        playerInstance = null;
      }
      const container = document.getElementById(containerIdRef.current);
      if (container) {
        container.remove();
      }
    };
  }, [isReady]);

  const playYouTubeTrack = useCallback(
    async (url: string, offsetSeconds: number) => {
      const player = playerRef.current || playerInstance;
      
      if (!isReady || !player) {
        console.log("YouTube player not ready", { 
          isReady, 
          hasPlayer: !!player,
        });
        throw new Error("YouTube player not ready yet");
      }

      // Check if player is actually ready by checking if methods exist
      if (typeof player.getPlayerState !== 'function') {
        console.log("YouTube player methods not available yet, waiting...");
        throw new Error("YouTube player not ready yet");
      }

      const videoId = extractYouTubeId(url);
      if (!videoId) {
        console.log("Not a valid YouTube URL", url);
        return;
      }

      try {
        // Set volume to 100% and unmute (ensure audio is not muted)
        player.setVolume(100);
        player.unMute();
        
        // Load the video
        player.loadVideoById({
          videoId: videoId,
          startSeconds: Math.max(0, offsetSeconds),
        });

        // Wait for video to load, then play
        const checkAndPlay = () => {
          try {
            const playerState = player.getPlayerState();
            // YouTube player states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
            
            if (playerState === window.YT.PlayerState.CUED || 
                playerState === window.YT.PlayerState.BUFFERING ||
                playerState === window.YT.PlayerState.UNSTARTED) {
              // Video is loaded or loading, try to play
              player.setVolume(100); // Ensure volume is set
              player.unMute(); // Ensure not muted
              player.playVideo();
              console.log("✅ YouTube audio playing at", offsetSeconds, "seconds");
            } else if (playerState === window.YT.PlayerState.PLAYING) {
              // Already playing
              console.log("✅ YouTube audio already playing");
            } else {
              // Not ready yet, retry
              setTimeout(checkAndPlay, 200);
            }
          } catch (e) {
            console.error("Error playing YouTube video:", e);
            // Fallback: try direct play
            try {
              player.setVolume(100);
              player.unMute();
              player.playVideo();
            } catch (e2) {
              console.error("Fallback play also failed:", e2);
            }
          }
        };

        // Start checking after a short delay to let video load
        setTimeout(checkAndPlay, 300);
      } catch (e) {
        console.error("Error starting YouTube playback", e);
        throw e;
      }
    },
    [isReady, playerInitialized]
  );

  const stopYouTubeTrack = useCallback(() => {
    const player = playerRef.current || playerInstance;
    if (player && typeof player.stopVideo === 'function') {
      try {
        player.stopVideo();
        console.log("🛑 YouTube audio stopped");
      } catch (e) {
        console.error("Error stopping YouTube video:", e);
      }
    }
  }, []);

  // Check if player is actually ready by verifying methods exist
  const player = playerRef.current || playerInstance;
  const actuallyReady = isReady && player && typeof player.getPlayerState === 'function';
  
  return { isReady: actuallyReady, playYouTubeTrack, stopYouTubeTrack };
}

