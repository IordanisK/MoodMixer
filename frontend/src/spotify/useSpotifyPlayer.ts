// Native / default stub – no Spotify playback
export function useSpotifyPlayer() {
  return {
    isReady: false,
    playSpotifyTrack: (_url: string, _offsetSeconds: number) => {},
    setOnTrackEnded: (_callback: (() => void) | null) => {},
  };
}
