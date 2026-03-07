import { useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/project-store";
import { useToastStore } from "@/stores/toast-store";
import { v4 as uuid } from "uuid";
import type { TimelineDiff } from "@shared/types";

interface PlaybackRef {
  togglePlayback: () => void;
  currentTimeMs: number;
}

export function useKeyboardShortcuts(playbackRef: React.RefObject<PlaybackRef | null>) {
  const ref = useRef(playbackRef);
  ref.current = playbackRef;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.code) {
        case "Space": {
          e.preventDefault();
          ref.current.current?.togglePlayback();
          break;
        }

        case "KeyS": {
          if (e.metaKey || e.ctrlKey) return;
          e.preventDefault();
          const { project, selectedClipId } = useProjectStore.getState();
          if (!project || !selectedClipId) return;

          const currentTimeMs = ref.current.current?.currentTimeMs ?? 0;
          const diff: TimelineDiff = {
            id: uuid(),
            description: "Split clip at playhead",
            ops: [{ type: "split", clipId: selectedClipId, atMs: currentTimeMs }],
          };
          useProjectStore.getState().applyDiffToProject(diff);
          break;
        }

        case "Backspace":
        case "Delete": {
          e.preventDefault();
          const { selectedClipId } = useProjectStore.getState();
          if (!selectedClipId) return;

          const diff: TimelineDiff = {
            id: uuid(),
            description: "Delete selected clip",
            ops: [{ type: "remove_clip", clipId: selectedClipId }],
          };
          useProjectStore.getState().applyDiffToProject(diff);
          useProjectStore.getState().deselectAll();
          break;
        }

        case "KeyZ": {
          if (!(e.metaKey || e.ctrlKey)) return;
          e.preventDefault();
          fetch("/api/timeline/commits")
            .then((r) => {
              if (!r.ok) throw new Error("Could not fetch commits");
              return r.json();
            })
            .then((commits: Array<{ id: string }>) => {
              const last = commits[commits.length - 1];
              if (!last) throw new Error("Nothing to undo");
              return fetch(`/api/timeline/revert/${last.id}`, { method: "POST" });
            })
            .then((r) => {
              if (!r.ok) throw new Error("Revert failed");
              return r.json();
            })
            .then((body: { state: unknown }) => {
              useProjectStore.setState({ project: body.state as any });
              useToastStore.getState().addToast("Reverted last edit", "success");
            })
            .catch((err) => {
              useToastStore.getState().addToast(err.message, "error");
            });
          break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
