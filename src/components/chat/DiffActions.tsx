import type { TimelineDiff } from "@shared/types";
import { useChatStore } from "@/stores/chat-store";

interface DiffActionsProps {
  diff: TimelineDiff;
}

export function DiffActions({ diff }: DiffActionsProps) {
  const isApplied = useChatStore((s) => diff.id ? s.appliedDiffIds.has(diff.id) : false);

  if (isApplied) return null;

  return (
    <div className="flex gap-2 mt-2">
      <button
        className="text-xs text-muted-foreground hover:text-primary transition-colors duration-150 underline underline-offset-2"
        onClick={() => useChatStore.getState().applyDiff(diff)}
      >
        Apply
      </button>
    </div>
  );
}
