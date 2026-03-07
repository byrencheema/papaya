import { useProjectStore } from "@/stores/project-store";
import { useUIStore } from "@/stores/ui-store";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Track } from "./Track";
import { PlayheadCursor } from "./PlayheadCursor";
import { Ruler } from "./Ruler";
import type { usePlayback } from "@/hooks/use-playback";
import { useRef, useCallback } from "react";

interface TimelinePanelProps {
  playback: ReturnType<typeof usePlayback>;
}

export function TimelinePanel({ playback }: TimelinePanelProps) {
  const tracks = useProjectStore((s) => s.project?.tracks ?? []);
  const durationMs = useProjectStore((s) => s.project?.durationMs ?? 0);
  const zoom = useUIStore((s) => s.zoom);
  const setZoom = useUIStore((s) => s.setZoom);
  const timelineRef = useRef<HTMLDivElement>(null);

  const totalWidth = Math.max(durationMs * zoom + 200, 800);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.01 : 0.01;
        setZoom(zoom + delta);
      }
    },
    [zoom, setZoom]
  );

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const ms = x / zoom;
      playback.seek(ms);
    },
    [zoom, playback]
  );

  const hasClips = tracks.some((t) => t.clips.length > 0);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1" onWheel={handleWheel}>
        <div className="flex h-full">
          <div className="w-20 shrink-0 border-r border-outline-variant bg-surface">
            <div className="h-6" />
            {tracks.map((track) => (
              <div
                key={track.id}
                className="flex h-10 items-center border-b border-outline-variant/50 px-3"
              >
                <span className="truncate text-[11px] font-medium text-muted-foreground">
                  {track.label}
                </span>
              </div>
            ))}
          </div>
          <div
            ref={timelineRef}
            className="relative flex-1"
            style={{ minWidth: totalWidth }}
            onClick={handleTimelineClick}
          >
            <Ruler durationMs={durationMs} zoom={zoom} />
            {tracks.map((track) => (
              <Track key={track.id} track={track} zoom={zoom} currentTimeMs={playback.currentTimeMs} />
            ))}
            <PlayheadCursor
              currentTimeMs={playback.currentTimeMs}
              zoom={zoom}
              height={tracks.length * 40 + 24}
            />
            {!hasClips && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-xs text-muted-foreground">Add clips to the timeline</p>
              </div>
            )}
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
