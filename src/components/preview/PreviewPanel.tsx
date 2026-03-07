import { VideoPlayer } from "./VideoPlayer";
import { TransportBar } from "./TransportBar";
import { DiffOverlay } from "./DiffOverlay";
import { useProjectStore } from "@/stores/project-store";
import type { usePlayback } from "@/hooks/use-playback";

interface PreviewPanelProps {
  playback: ReturnType<typeof usePlayback>;
}

export function PreviewPanel({ playback }: PreviewPanelProps) {
  const project = useProjectStore((s) => s.project);
  const previewDiff = useProjectStore((s) => s.previewDiff);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
      <div className="relative flex-1 flex items-center justify-center w-full min-h-0">
        <div className="relative rounded-2xl overflow-hidden shadow-[var(--shadow-2)]" style={{ aspectRatio: "9/16", maxHeight: "100%", height: "100%" }}>
          <VideoPlayer
            project={project}
            currentTimeMs={playback.currentTimeMs}
            videoRef={playback.videoRef}
            audioRef={playback.audioRef}
            isPlaying={playback.isPlaying}
          />
          {previewDiff && <DiffOverlay />}
        </div>
      </div>
      <TransportBar
        currentTimeMs={playback.currentTimeMs}
        durationMs={project?.durationMs ?? 0}
        isPlaying={playback.isPlaying}
        onTogglePlayback={playback.togglePlayback}
        onSeek={playback.seek}
      />
    </div>
  );
}
