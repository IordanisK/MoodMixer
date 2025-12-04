// Native / default stub – no Spotify playback
export function useSpotifyPlayer(_shouldInit: boolean = true) {
  return {
    isReady: false,
    playSpotifyTrack: async (_url: string, _offsetSeconds: number) => {},
    setOnTrackEnded: (_callback: (() => void) | null) => {},
    stopSpotify: async () => {},
    refreshConnection: async () => {},
  };
}
