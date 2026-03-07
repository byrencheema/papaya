import type { Clip as ClipType, TrackType } from "@shared/types";
import { useProjectStore } from "@/stores/project-store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { useCallback, useRef } from "react";

interface ClipProps {
  clip: ClipType;
  trackType: TrackType;
  zoom: number;
  currentTimeMs: number;
}

const trackColors: Record<TrackType, string> = {
  video: "bg-[#7DC4E4]/25 border-[#7DC4E4]/40 hover:bg-[#7DC4E4]/35",
  audio: "bg-[#A8DAB5]/25 border-[#A8DAB5]/40 hover:bg-[#A8DAB5]/35",
  caption: "bg-[#F2D679]/25 border-[#F2D679]/40 hover:bg-[#F2D679]/35",
};

export function Clip({ clip, trackType, zoom, currentTimeMs }: ClipProps) {
  const selectedClipId = useProjectStore((s) => s.selectedClipId);
  const selectClip = useProjectStore((s) => s.selectClip);
  const applyDiffToProject = useProjectStore((s) => s.applyDiffToProject);
  const getAssetById = useProjectStore((s) => s.getAssetById);
  const trimRef = useRef<{ side: "left" | "right"; startX: number; originalMs: number } | null>(null);

  const asset = getAssetById(clip.assetId);
  const isSelected = selectedClipId === clip.id;
  const left = clip.startMs * zoom;
  const width = Math.max(clip.durationMs * zoom, 4);

  const playheadInClip =
    currentTimeMs > clip.startMs && currentTimeMs < clip.startMs + clip.durationMs;

  function handleSplitAtPlayhead() {
    if (!playheadInClip) return;
    applyDiffToProject({
      id: crypto.randomUUID(),
      description: "Split clip at playhead",
      ops: [{ type: "split", clipId: clip.id, atMs: currentTimeMs }],
    });
  }

  function handleSplitAtMidpoint() {
    applyDiffToProject({
      id: crypto.randomUUID(),
      description: "Split clip at midpoint",
      ops: [{ type: "split", clipId: clip.id, atMs: clip.startMs + clip.durationMs / 2 }],
    });
  }

  function handleDelete() {
    applyDiffToProject({
      id: crypto.randomUUID(),
      description: "Remove clip",
      ops: [{ type: "remove_clip", clipId: clip.id }],
    });
  }

  function handleRippleDelete() {
    applyDiffToProject({
      id: crypto.randomUUID(),
      description: "Ripple delete clip",
      ops: [{ type: "ripple_delete", clipId: clip.id }],
    });
  }

  const handleTrimStart = useCallback(
    (side: "left" | "right", e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const startX = e.clientX;
      const originalMs = side === "left" ? clip.startMs : clip.startMs + clip.durationMs;
      trimRef.current = { side, startX, originalMs };

      const onMove = (ev: MouseEvent) => {
        if (!trimRef.current) return;
        const deltaX = ev.clientX - trimRef.current.startX;
        const deltaMs = deltaX / zoom;
        const newMs = Math.round(trimRef.current.originalMs + deltaMs);

        if (trimRef.current.side === "left") {
          const maxStart = clip.startMs + clip.durationMs - 100;
          const clampedStart = Math.max(0, Math.min(newMs, maxStart));
          const deltaFromOriginal = clampedStart - clip.startMs;
          applyDiffToProject({
            id: crypto.randomUUID(),
            description: "Trim clip start",
            ops: [{
              type: "trim",
              clipId: clip.id,
              newStartMs: clampedStart,
              newDurationMs: clip.durationMs - deltaFromOriginal,
              newInPointMs: clip.inPointMs + deltaFromOriginal,
            }],
          });
        } else {
          const minEnd = clip.startMs + 100;
          const clampedEnd = Math.max(minEnd, newMs);
          const newDuration = clampedEnd - clip.startMs;
          applyDiffToProject({
            id: crypto.randomUUID(),
            description: "Trim clip end",
            ops: [{
              type: "trim",
              clipId: clip.id,
              newDurationMs: newDuration,
              newOutPointMs: clip.inPointMs + newDuration,
            }],
          });
        }

        trimRef.current = null;
      };

      const onUp = () => {
        trimRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [clip, zoom, applyDiffToProject]
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group absolute top-1 bottom-1 flex items-center overflow-hidden rounded-lg border text-xs cursor-pointer select-none transition-colors duration-150",
            trackColors[trackType],
            isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-surface-low"
          )}
          style={{ left, width }}
          onClick={(e) => {
            e.stopPropagation();
            selectClip(clip.id);
          }}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize bg-white/0 hover:bg-white/20 transition-colors z-10 rounded-l-lg"
            onMouseDown={(e) => handleTrimStart("left", e)}
          />
          <span className="truncate text-foreground/80 px-2.5 text-[11px] font-medium">
            {asset?.name ?? "Clip"}
          </span>
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize bg-white/0 hover:bg-white/20 transition-colors z-10 rounded-r-lg"
            onMouseDown={(e) => handleTrimStart("right", e)}
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="rounded-xl">
        {playheadInClip && (
          <ContextMenuItem onClick={handleSplitAtPlayhead}>
            Split at Playhead
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={handleSplitAtMidpoint}>Split at Midpoint</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleDelete}>Delete</ContextMenuItem>
        <ContextMenuItem onClick={handleRippleDelete}>Ripple Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
