import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="flex w-full max-w-lg items-center gap-3 rounded-full bg-surface-high px-3 py-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full text-foreground hover:bg-surface-highest"
        onClick={onTogglePlayback}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </Button>
      <span className="shrink-0 text-[11px] font-mono text-muted-foreground w-14 text-right tabular-nums">
        {formatTimecode(currentTimeMs)}
      </span>
      <div
        ref={scrubberRef}
        className="group relative h-1 flex-1 cursor-pointer rounded-full bg-outline-variant"
        onClick={handleScrub}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-75"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 rounded-full bg-primary shadow-[var(--shadow-1)] opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }}
        />
      </div>
      <span className="shrink-0 text-[11px] font-mono text-muted-foreground w-14 tabular-nums">
        {formatTimecode(durationMs)}
      </span>
    </div>
  );
}
