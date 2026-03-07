interface PlayheadCursorProps {
  currentTimeMs: number;
  zoom: number;
  height: number;
}

export function PlayheadCursor({ currentTimeMs, zoom, height }: PlayheadCursorProps) {
  const left = currentTimeMs * zoom;

  return (
    <div
      className="absolute top-0 z-20 pointer-events-none"
      style={{ left, height }}
    >
      <div className="relative">
        <div
          className="absolute -left-1.5 top-0 h-3 w-3 bg-primary"
          style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
        />
        <div className="absolute left-0 top-0 w-px bg-primary" style={{ height }} />
      </div>
    </div>
  );
}
