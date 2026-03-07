import { useState, useRef } from "react";
import { Download, Wand2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { BinPanel } from "@/components/bins/BinPanel";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ExportDialog } from "@/components/preview/ExportDialog";
import { TimelinePanel } from "@/components/timeline/TimelinePanel";
import { Toasts } from "@/components/layout/Toasts";
import { Button } from "@/components/ui/button";
import { useProject } from "@/hooks/use-project";
import { usePlayback } from "@/hooks/use-playback";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useChatStore } from "@/stores/chat-store";
import { cn } from "@/lib/utils";

export function AppShell() {
  const { project, loading } = useProject();
  const playback = usePlayback(project?.durationMs ?? 0, project ?? null);
  const [exportOpen, setExportOpen] = useState(false);
  const [binCollapsed, setBinCollapsed] = useState(false);
  const playbackRef = useRef(playback);
  playbackRef.current = playback;
  useKeyboardShortcuts(playbackRef);

  if (loading && !project) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-lowest text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface-lowest text-foreground">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-outline-variant px-4 bg-surface-low">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            onClick={() => setBinCollapsed(!binCollapsed)}
          >
            {binCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
          <img src="/banana-icon.png" alt="" className="h-6 w-6 shrink-0 rounded" />
          <span className="text-sm font-semibold tracking-tight text-foreground truncate">
            {project?.name ?? "Bananacut"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            className="h-8 gap-2 rounded-full px-4"
            onClick={() => {
              const { sendMessage, isStreaming } = useChatStore.getState();
              if (!isStreaming) sendMessage("Auto edit this video: analyze all clips, make smart cuts, add a soundtrack, and create a title card.");
            }}
          >
            <Wand2 className="h-3.5 w-3.5" />
            Auto Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 rounded-full px-4"
            onClick={() => setExportOpen(true)}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "shrink-0 border-r border-outline-variant bg-surface-low transition-all duration-300 overflow-hidden",
            binCollapsed ? "w-0 border-r-0" : "w-[240px]"
          )}
          style={{ transitionTimingFunction: "var(--ease-emphasized-decel)" }}
        >
          <div className="w-[240px] h-full overflow-hidden">
            <BinPanel />
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-hidden bg-surface-lowest">
          <PreviewPanel playback={playback} />
        </div>

        <div className="w-[380px] shrink-0 border-l border-outline-variant bg-surface-low overflow-hidden">
          <ChatPanel />
        </div>
      </div>

      <div className="h-[180px] shrink-0 border-t border-outline-variant bg-surface-low overflow-hidden">
        <TimelinePanel playback={playback} />
      </div>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <Toasts />
    </div>
  );
}
