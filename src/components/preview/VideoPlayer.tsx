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
  const mountedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mountedRef.current) return;
    mountedRef.current = true;
    compositionManager.mount(el);
    const canvas = el.querySelector("canvas");
    if (canvas) {
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.objectFit = "contain";
    }
    return () => {
      mountedRef.current = false;
      compositionManager.unmount();
    };
  }, []);

  useEffect(() => {
    if (!project) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      compositionManager.syncFromProject(project);
    }, 100);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [project]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black" />
  );
}
