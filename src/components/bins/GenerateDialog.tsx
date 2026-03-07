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
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/stores/project-store";
import { useToastStore } from "@/stores/toast-store";
import type { Asset } from "@shared/types";

type GenerateMode = "video" | "music" | "image";

interface GenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: GenerateMode;
}

export function GenerateDialog({ open, onOpenChange, mode }: GenerateDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("5");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const addToast = useToastStore((s) => s.addToast);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setProgress("Submitting generation request...");

    try {
      const endpoints: Record<GenerateMode, string> = {
        video: "/api/generate/video",
        music: "/api/generate/music",
        image: "/api/generate/image",
      };
      const endpoint = endpoints[mode];
      const payload: Record<string, unknown> = { prompt: prompt.trim() };
      if (mode !== "image") {
        payload.durationSeconds = parseInt(duration, 10) || 5;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `Generation failed (${res.status})`);
      }

      const asset = (await res.json()) as Asset;
      useProjectStore.setState((s) => {
        if (!s.project) return s;
        return {
          project: {
            ...s.project,
            assets: [...s.project.assets, asset],
          },
        };
      });

      const labels: Record<GenerateMode, string> = { video: "video", music: "music", image: "image" };
      addToast(`Generated ${labels[mode]}: ${asset.name}`, "success");
      setPrompt("");
      setProgress("");
      onOpenChange(false);
    } catch (e) {
      addToast((e as Error).message, "error");
      setProgress("");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Generate {mode === "video" ? "Video" : mode === "image" ? "Image" : "Music"}
          </DialogTitle>
          <DialogDescription>
            {mode === "video"
              ? "Describe the video you want Veo to generate."
              : mode === "image"
                ? "Describe the image you want to generate (title card, b-roll, thumbnail)."
                : "Describe the background music you want Lyria to compose."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Input
            placeholder={
              mode === "video"
                ? "A cinematic drone shot over a tropical beach at sunset..."
                : mode === "image"
                  ? "A bold title card with 'MY VIDEO' in neon on a dark background..."
                  : "Upbeat lo-fi hip hop with gentle piano melody..."
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={generating}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !generating) handleGenerate();
            }}
          />
          {mode !== "image" && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground whitespace-nowrap">
                Duration (sec)
              </label>
              <Input
                type="number"
                min={1}
                max={60}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={generating}
                className="w-20"
              />
            </div>
          )}
          {generating && (
            <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">{progress}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
            disabled={generating}
          >
            Cancel
          </Button>
          <Button
            className="rounded-full"
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
          >
            {generating ? "Generating..." : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
