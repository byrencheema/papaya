import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/stores/project-store";
import { Upload } from "lucide-react";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const importAsset = useProjectStore((s) => s.importAsset);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setProgress(0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      await importAsset(file);
      setProgress(Math.round(((i + 1) / files.length) * 100));
    }

    setUploading(false);
    setProgress(0);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Media</DialogTitle>
          <DialogDescription>
            Select video, audio, or image files to import into your project.
          </DialogDescription>
        </DialogHeader>
        <div
          className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-outline-variant p-10 cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors duration-200"
          onClick={() => inputRef.current?.click()}
        >
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            Click to select files
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="video/*,audio/*,image/*"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
        {uploading && (
          <div className="flex items-center gap-3">
            <div className="h-1 flex-1 rounded-full bg-surface-highest overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
