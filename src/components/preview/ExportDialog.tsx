import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/stores/project-store";
import { useToastStore } from "@/stores/toast-store";
import { compositionManager } from "@/lib/composition-manager";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const project = useProjectStore((s) => s.project);
  const addToast = useToastStore((s) => s.addToast);

  const hasClips = project?.tracks.some((t) => t.clips.length > 0) ?? false;

  const handleExport = async () => {
    if (!project) return;
    setExporting(true);
    setProgress(0);

    try {
      const result = await compositionManager.export((p) => {
        setProgress(Math.round((p.progress / p.total) * 100));
      });

      if (result.type === "success" && result.data) {
        const url = URL.createObjectURL(result.data);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${project.name}.mp4`;
        link.click();
        URL.revokeObjectURL(url);
        setProgress(100);
        addToast("Export complete!", "success");
        onOpenChange(false);
      } else if (result.type === "error") {
        throw result.error;
      }
    } catch (e) {
      addToast((e as Error).message, "error");
    } finally {
      setExporting(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
          <DialogDescription>
            Export your project as an MP4 video.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 text-sm rounded-xl bg-surface p-4">
            <span className="text-muted-foreground">Resolution</span>
            <span className="text-foreground">{project?.dimensions.width ?? 1080} x {project?.dimensions.height ?? 1920}</span>
            <span className="text-muted-foreground">Format</span>
            <span className="text-foreground">MP4 (H.264)</span>
            <span className="text-muted-foreground">Aspect Ratio</span>
            <span className="text-foreground">9:16</span>
          </div>
          {!hasClips && (
            <p className="text-sm text-destructive">
              No clips on the timeline. Add clips before exporting.
            </p>
          )}
          {exporting && (
            <div className="flex flex-col gap-2">
              <div className="h-1 w-full rounded-full bg-surface-highest overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground text-center">
                {progress < 100 ? `Exporting... ${progress}%` : "Done!"}
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
            disabled={exporting}
          >
            Cancel
          </Button>
          <Button
            className="rounded-full"
            onClick={handleExport}
            disabled={exporting || !hasClips}
          >
            {exporting ? "Exporting..." : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
