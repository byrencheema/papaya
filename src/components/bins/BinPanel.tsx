import { Plus, Sparkles, Music, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AssetCard } from "./AssetCard";
import { ImportDialog } from "./ImportDialog";
import { GenerateDialog } from "./GenerateDialog";
import { useProjectStore } from "@/stores/project-store";
import { useState } from "react";

export function BinPanel() {
  const assets = useProjectStore((s) => s.project?.assets ?? []);
  const [importOpen, setImportOpen] = useState(false);
  const [generateMode, setGenerateMode] = useState<"video" | "music" | "image" | null>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Media</span>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground" onClick={() => setGenerateMode("video")}>
            <Sparkles className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground" onClick={() => setGenerateMode("image")}>
            <ImageIcon className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground" onClick={() => setGenerateMode("music")}>
            <Music className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground" onClick={() => setImportOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
        {assets.length === 0 && (
          <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-8 text-center">
            <p className="text-xs text-muted-foreground">Import media to get started</p>
            <div className="flex flex-col gap-2 w-full max-w-[180px]">
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-full w-full"
                onClick={() => setImportOpen(true)}
              >
                Import Media
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-full w-full text-muted-foreground"
                onClick={() => setGenerateMode("video")}
              >
                <Sparkles className="mr-1.5 h-3 w-3" />
                Generate Video
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-full w-full text-muted-foreground"
                onClick={() => setGenerateMode("image")}
              >
                <ImageIcon className="mr-1.5 h-3 w-3" />
                Generate Image
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-full w-full text-muted-foreground"
                onClick={() => setGenerateMode("music")}
              >
                <Music className="mr-1.5 h-3 w-3" />
                Generate Music
              </Button>
            </div>
          </div>
        )}
      </ScrollArea>
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <GenerateDialog
        open={generateMode !== null}
        onOpenChange={(open) => { if (!open) setGenerateMode(null); }}
        mode={generateMode ?? "video"}
      />
    </div>
  );
}
