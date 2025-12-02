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
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
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
  const containerIdRef = useRef(
    `youtube-audio-player-${Math.random().toString(36).substr(2, 9)}`
  );

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
    // Note: Player must be at least 1px visible for audio to work in some browsers
    let container = document.getElementById(containerIdRef.current);
    if (!container) {
      container = document.createElement("div");
      container.id = containerIdRef.current;
      container.style.position = "fixed";
      container.style.left = "0";
      container.style.top = "0";
      container.style.width = "1px";
      container.style.height = "1px";
      container.style.opacity = "0.01"; // Very slightly visible for audio
      container.style.pointerEvents = "none";
      container.style.zIndex = "-1";
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
            const player = playerRef.current || playerInstance;
            try {
              // Ensure volume is set and unmuted when player is ready
              if (player && typeof player.setVolume === "function") {
                player.setVolume(100);
                player.unMute();
                console.log("✅ Volume set to 100% and unmuted on ready");
              }
            } catch (e) {
              console.error("Error setting volume on ready:", e);
            }
            setPlayerInitialized(true);
          },
          onStateChange: (event: any) => {
            const player = playerRef.current || playerInstance;
            if (event.data === window.YT.PlayerState.PLAYING) {
              console.log("🎵 YouTube audio is playing");
              // Ensure volume is set and unmuted when playing starts
              // This is critical for autoplay workaround (start muted, then unmute)
              try {
                if (player) {
                  // Delay to ensure playback has fully started before unmuting
                  // Using 2 seconds to give the browser time to process the playback
                  setTimeout(() => {
                    try {
                      // Check current state before setting
                      const currentVolume = player.getVolume
                        ? player.getVolume()
                        : null;
                      const isMuted = player.isMuted ? player.isMuted() : null;
                      console.log("Player volume state on PLAYING:", {
                        currentVolume,
                        isMuted,
                      });

                      // Always set to 100% and unmute
                      player.setVolume(100);
                      player.unMute();

                      // Verify after setting
                      const newVolume = player.getVolume
                        ? player.getVolume()
                        : null;
                      const stillMuted = player.isMuted
                        ? player.isMuted()
                        : null;
                      console.log("Player volume after unmute (2s delay):", {
                        newVolume,
                        stillMuted,
                      });
                    } catch (e) {
                      console.error("Error in delayed unmute:", e);
                    }
                  }, 2000);
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
      if (typeof player.getPlayerState !== "function") {
        console.log("YouTube player methods not available yet, waiting...");
        throw new Error("YouTube player not ready yet");
      }

      const videoId = extractYouTubeId(url);
      if (!videoId) {
        console.log("Not a valid YouTube URL", url);
        return;
      }

      try {
        // Strategy: Start muted to bypass autoplay restrictions, then unmute after playback starts
        // Many browsers allow muted autoplay but block unmuted autoplay
        player.setVolume(100);
        player.mute(); // Start muted to bypass autoplay policy

        // Load the video
        player.loadVideoById({
          videoId: videoId,
          startSeconds: Math.max(0, offsetSeconds),
        });

        // Wait for video to load, then play
        let retryCount = 0;
        const maxRetries = 20; // Max 4 seconds of retries

        const checkAndPlay = () => {
          try {
            const playerState = player.getPlayerState();
            // YouTube player states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)

            // Ensure volume is set (but keep muted for autoplay workaround)
            player.setVolume(100);
            // Don't unmute here - we'll unmute after playback starts

            if (
              playerState === window.YT.PlayerState.CUED ||
              playerState === window.YT.PlayerState.BUFFERING ||
              playerState === window.YT.PlayerState.UNSTARTED
            ) {
              // Video is loaded or loading, try to play (muted to bypass autoplay policy)
              try {
                player.playVideo();
                console.log(
                  "✅ YouTube audio playing (muted) at",
                  offsetSeconds,
                  "seconds"
                );

                // Unmute after a delay once playback has started
                // This works around browser autoplay restrictions
                // Using 1.5 seconds to give playback time to fully start
                setTimeout(() => {
                  try {
                    const state = player.getPlayerState();
                    if (state === window.YT.PlayerState.PLAYING) {
                      player.unMute();
                      player.setVolume(100);
                      console.log(
                        "✅ YouTube audio unmuted (1.5s delay) - should hear sound now"
                      );
                    } else {
                      // Not playing yet, try again with longer delay
                      player.playVideo();
                      setTimeout(() => {
                        if (
                          player.getPlayerState() ===
                          window.YT.PlayerState.PLAYING
                        ) {
                          player.unMute();
                          player.setVolume(100);
                          console.log(
                            "✅ YouTube audio unmuted (retry after 2s)"
                          );
                        }
                      }, 2000);
                    }
                  } catch (e) {
                    console.error("Error unmuting:", e);
                  }
                }, 1500);
              } catch (e) {
                console.error("Error calling playVideo():", e);
              }
            } else if (playerState === window.YT.PlayerState.PLAYING) {
              // Already playing - ensure unmuted and volume is correct
              const currentVolume = player.getVolume();
              const isMuted = player.isMuted();
              if (currentVolume !== 100 || isMuted) {
                console.log("Correcting volume/mute state:", {
                  currentVolume,
                  isMuted,
                });
                player.setVolume(100);
                player.unMute();
              }
              console.log("✅ YouTube audio already playing");
            } else if (retryCount < maxRetries) {
              // Not ready yet, retry
              retryCount++;
              setTimeout(checkAndPlay, 200);
            } else {
              console.error("YouTube player failed to start after max retries");
            }
          } catch (e) {
            console.error("Error in checkAndPlay:", e);
            // Fallback: try direct play with volume set
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
    if (player && typeof player.stopVideo === "function") {
      try {
        player.stopVideo();
        console.log("🛑 YouTube audio stopped");
      } catch (e) {
        console.error("Error stopping YouTube video:", e);
      }
    }
  }, []);

  // Check if player is actually ready by verifying methods exist
  // Use playerInitialized state to trigger re-renders when player becomes ready
  const player = playerRef.current || playerInstance;
  const actuallyReady =
    isReady &&
    playerInitialized &&
    player &&
    typeof player.getPlayerState === "function";

  return { isReady: actuallyReady, playYouTubeTrack, stopYouTubeTrack };
}
