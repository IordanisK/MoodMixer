// Non-web version - YouTube playback not supported on mobile
export function useYouTubePlayer() {
  return {
    isReady: false,
    playYouTubeTrack: async () => {
      console.log("YouTube playback not supported on mobile");
    },
    stopYouTubeTrack: () => {
      console.log("YouTube playback not supported on mobile");
    },
  };
}

