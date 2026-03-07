import type { TimelineDiff } from "@shared/types";
import { useChatStore } from "@/stores/chat-store";
import { Check } from "lucide-react";

interface PlanCardProps {
  plan?: string;
  diff: TimelineDiff;
}

export function PlanCard({ diff }: PlanCardProps) {
  const isApplied = useChatStore((s) => diff.id ? s.appliedDiffIds.has(diff.id) : false);

  if (!isApplied) return null;

  return (
    <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted-foreground">
      <Check className="h-3 w-3" />
      <span>{diff.description || "Applied"}</span>
    </div>
  );
}
