import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/chat-store";
import type { TimelineDiff } from "@shared/types";

interface DiffActionsProps {
  diff: TimelineDiff;
}

export function DiffActions({ diff }: DiffActionsProps) {
  const previewDiff = useChatStore((s) => s.previewDiff);
  const applyDiff = useChatStore((s) => s.applyDiff);
  const revertPreview = useChatStore((s) => s.revertPreview);
  const previewSnapshot = useChatStore((s) => s.previewSnapshot);
  const isApplied = useChatStore((s) => diff.id ? s.appliedDiffIds.has(diff.id) : false);
  const isPreviewActive = previewSnapshot !== null;

  if (isApplied) {
    return (
      <div className="flex items-center gap-1.5 mt-2.5 text-xs text-success font-medium">
        <Check className="h-3.5 w-3.5" />
        Applied
      </div>
    );
  }

  return (
    <div className="flex gap-2 mt-2.5">
      {!isPreviewActive && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-full px-4 text-xs border-outline-variant"
          onClick={() => previewDiff(diff)}
        >
          Preview
        </Button>
      )}
      {isPreviewActive && (
        <>
          <Button
            size="sm"
            className="h-8 rounded-full px-4 text-xs bg-success text-success-foreground hover:bg-success/80"
            onClick={() => applyDiff(diff)}
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            Apply
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-4 text-xs border-destructive text-destructive hover:bg-destructive/10"
            onClick={revertPreview}
          >
            Revert
          </Button>
        </>
      )}
    </div>
  );
}
