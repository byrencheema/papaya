import { useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useProjectStore } from "@/stores/project-store";
import { Film, Music, ImageIcon } from "lucide-react";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const importAsset = useProjectStore((s) => s.importAsset);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
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

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden border-0 bg-transparent shadow-none">
        <div
          className={`flex flex-col items-center gap-5 p-8 cursor-pointer transition-all duration-150 bg-surface-high border border-outline-variant rounded-lg ${dragging ? "border-primary bg-primary/5 scale-[1.02]" : "hover:border-primary/40"}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div className="flex gap-3 text-muted-foreground/40">
            <Film className="h-5 w-5" />
            <Music className="h-5 w-5" />
            <ImageIcon className="h-5 w-5" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-medium text-foreground">
              {dragging ? "Drop files" : "Drop files here"}
            </p>
            <p className="text-xs text-muted-foreground">
              or click to browse
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="video/*,audio/*,image/*"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {uploading && (
            <div className="w-full flex items-center gap-3">
              <div className="h-0.5 flex-1 bg-surface-highest overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
