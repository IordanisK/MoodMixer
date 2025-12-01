// src/api/metadata.ts
import api from "./client";

export type TrackMetadata = {
  provider: string;
  title: string;
  author: string;
  thumbnail: string;
};

export async function fetchTrackMetadata(url: string): Promise<TrackMetadata> {
  const res = await api.get<TrackMetadata>("/metadata", {
    params: { url },
  });
  return res.data;
}
