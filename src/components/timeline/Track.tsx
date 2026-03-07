import type { Track as TrackType } from "@shared/types";
import { Clip } from "./Clip";

interface TrackProps {
  track: TrackType;
  zoom: number;
  currentTimeMs: number;
}

export function Track({ track, zoom, currentTimeMs }: TrackProps) {
  return (
    <div className="relative h-10 border-b border-outline-variant/50">
      {track.clips.map((clip) => (
        <Clip key={clip.id} clip={clip} trackType={track.type} zoom={zoom} currentTimeMs={currentTimeMs} />
      ))}
    </div>
  );
}
