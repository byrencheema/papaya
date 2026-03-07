import { Play, Pause, SkipBack } from "lucide-react";
import { formatTimecode } from "@/lib/utils";
import { useCallback, useRef } from "react";

interface TransportBarProps {
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  onTogglePlayback: () => void;
  onSeek: (ms: number) => void;
}

export function TransportBar({
  currentTimeMs,
  durationMs,
  isPlaying,
  onTogglePlayback,
  onSeek,
}: TransportBarProps) {
  const scrubberRef = useRef<HTMLDivElement>(null);

  const handleScrub = useCallback(
    (e: React.MouseEvent) => {
      const rect = scrubberRef.current?.getBoundingClientRect();
      if (!rect || durationMs === 0) return;
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek(ratio * durationMs);
    },
    [durationMs, onSeek]
  );

  const progress = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0;

  return (
    <div className="flex w-full items-center gap-2 px-1">
      <button
        className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => onSeek(0)}
      >
        <SkipBack className="h-3.5 w-3.5" />
      </button>
      <button
        className="shrink-0 p-1 text-foreground hover:text-primary transition-colors"
        onClick={onTogglePlayback}
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-px" />}
      </button>
      <span className="shrink-0 text-[10px] font-mono text-muted-foreground tabular-nums">
        {formatTimecode(currentTimeMs)}
      </span>
      <div
        ref={scrubberRef}
        className="group relative h-0.5 flex-1 cursor-pointer rounded-full bg-outline-variant"
        onClick={handleScrub}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-75"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="shrink-0 text-[10px] font-mono text-muted-foreground tabular-nums">
        {formatTimecode(durationMs)}
      </span>
    </div>
  );
}
