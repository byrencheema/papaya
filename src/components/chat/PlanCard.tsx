import type { TimelineDiff } from "@shared/types";
import { DiffActions } from "./DiffActions";
import { useChatStore } from "@/stores/chat-store";
import { cn } from "@/lib/utils";

interface PlanCardProps {
  plan?: string;
  diff: TimelineDiff;
}

const OP_LABELS: Record<string, string> = {
  split: "Split clip",
  trim: "Trim clip",
  ripple_delete: "Ripple delete",
  move: "Move clip",
  insert_asset: "Insert asset",
  add_captions: "Add captions",
  set_music: "Set music",
  duck_music: "Duck music",
  add_track: "Add track",
  remove_clip: "Remove clip",
};

export function PlanCard({ plan, diff }: PlanCardProps) {
  const isApplied = useChatStore((s) => diff.id ? s.appliedDiffIds.has(diff.id) : false);

  return (
    <div
      className={cn(
        "rounded-xl border p-3 mt-2.5 transition-colors duration-200",
        isApplied
          ? "border-success/40 bg-success/5"
          : "border-outline-variant bg-surface-low"
      )}
    >
      {plan && (
        <p className="text-sm text-on-surface-variant mb-2.5 leading-relaxed">{diff.description}</p>
      )}
      <div className="space-y-1.5">
        {diff.ops.map((op, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 text-xs text-foreground/80"
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                isApplied ? "bg-success" : "bg-primary"
              )}
            />
            <span>{OP_LABELS[op.type] ?? op.type}</span>
          </div>
        ))}
      </div>
      <DiffActions diff={diff} />
    </div>
  );
}
