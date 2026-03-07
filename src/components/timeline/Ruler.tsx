import { formatTimecode } from "@/lib/utils";

interface RulerProps {
  durationMs: number;
  zoom: number;
}

export function Ruler({ durationMs, zoom }: RulerProps) {
  const intervalMs = getInterval(zoom);
  const totalDuration = Math.max(durationMs, 5000);
  const marks: number[] = [];
  for (let ms = 0; ms <= totalDuration; ms += intervalMs) {
    marks.push(ms);
  }

  return (
    <div className="relative h-6 border-b border-outline-variant/50 bg-surface/50">
      {marks.map((ms) => (
        <div
          key={ms}
          className="absolute top-0 flex h-full flex-col items-start"
          style={{ left: ms * zoom }}
        >
          <div className="h-2.5 w-px bg-muted-foreground/30" />
          <span className="ml-1 text-[10px] text-muted-foreground/70 leading-none font-mono tabular-nums">
            {formatTimecode(ms)}
          </span>
        </div>
      ))}
    </div>
  );
}

function getInterval(zoom: number): number {
  if (zoom >= 0.5) return 1000;
  if (zoom >= 0.1) return 5000;
  if (zoom >= 0.05) return 10000;
  return 30000;
}
