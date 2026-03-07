export function DiffOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-tertiary/70">
      <span className="absolute left-3 top-3 rounded-full bg-tertiary px-2.5 py-1 text-[10px] font-semibold text-tertiary-foreground shadow-[var(--shadow-1)]">
        Preview
      </span>
    </div>
  );
}
