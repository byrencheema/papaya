import { v4 as uuid } from "uuid";
import type { Asset } from "@shared/types";
import { Film, Music, Image, PlusCircle } from "lucide-react";
import { formatTimecode } from "@/lib/utils";
import { useProjectStore } from "@/stores/project-store";

interface AssetCardProps {
  asset: Asset;
}

const iconMap = {
  video: Film,
  audio: Music,
  image: Image,
  generated_video: Film,
  generated_music: Music,
} as const;

export function AssetCard({ asset }: AssetCardProps) {
  const Icon = iconMap[asset.type] ?? Film;
  const applyDiffToProject = useProjectStore((s) => s.applyDiffToProject);

  function addToTimeline() {
    const isAudio = asset.type === "audio" || asset.type === "generated_music";
    const trackId = isAudio ? "A1" : "V1";

    const project = useProjectStore.getState().project;
    if (!project) return;

    const track = project.tracks.find((t) => t.id === trackId);
    const lastClipEnd = track?.clips.reduce((max, c) => Math.max(max, c.startMs + c.durationMs), 0) ?? 0;

    if (isAudio) {
      applyDiffToProject({
        id: uuid(),
        description: `Add ${asset.name} to timeline`,
        ops: [{ type: "set_music", assetId: asset.id, trackId, startMs: 0 }],
      });
    } else {
      applyDiffToProject({
        id: uuid(),
        description: `Add ${asset.name} to timeline`,
        ops: [{ type: "insert_asset", assetId: asset.id, trackId, startMs: lastClipEnd }],
      });
    }
  }

  return (
    <div className="group relative flex flex-col gap-1.5 rounded-xl bg-surface p-1.5 hover:bg-surface-high cursor-pointer transition-colors duration-200">
      <div
        className="flex aspect-video items-center justify-center rounded-lg bg-surface-highest relative overflow-hidden"
        onDoubleClick={addToTimeline}
      >
        {asset.thumbnailPath ? (
          <img
            src={asset.thumbnailPath}
            alt={asset.name}
            className="h-full w-full rounded-lg object-cover"
          />
        ) : (
          <Icon className="h-5 w-5 text-muted-foreground" />
        )}
        <button
          className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 group-hover:bg-black/50 group-hover:opacity-100 transition-all duration-200 rounded-lg"
          onClick={addToTimeline}
        >
          <PlusCircle className="h-6 w-6 text-white drop-shadow-lg" />
        </button>
      </div>
      <p className="truncate text-xs text-on-surface-variant px-1">{asset.name}</p>
      {asset.durationMs > 0 && (
        <span className="absolute right-3 top-3 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {formatTimecode(asset.durationMs)}
        </span>
      )}
      {(asset.type === "generated_video" || asset.type === "generated_music") && (
        <span className="absolute left-3 top-3 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
          AI
        </span>
      )}
    </div>
  );
}
