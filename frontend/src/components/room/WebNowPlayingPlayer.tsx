import React from "react";
import { View } from "react-native";

type Props = {
  url?: string;
  startedAt?: number | null;
  onTrackEnded?: () => void;
};

// Native/mobile: we don't render anything (for now)
export default function WebNowPlayingPlayer(_props: Props) {
  return <View />; // or just null; returning a View avoids RN complaining
}
