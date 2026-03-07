import { useEffect, useRef } from "react";
import { compositionManager } from "@/lib/composition-manager";
import type { ProjectState } from "@shared/types";

interface VideoPlayerProps {
  project: ProjectState | null;
  currentTimeMs: number;
  isPlaying: boolean;
}

export function VideoPlayer({ project }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    compositionManager.mount(el);
    const canvas = el.querySelector("canvas");
    if (canvas) {
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.objectFit = "contain";
    }
    return () => compositionManager.unmount();
  }, []);

  useEffect(() => {
    if (!project) return;
    compositionManager.syncFromProject(project);
  }, [project]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black" />
  );
}
