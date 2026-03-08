import { create } from "zustand";
import type { ProjectState, Asset, TimelineDiff } from "@shared/types";
import { applyDiff } from "@shared/diff-ops";

interface ProjectStore {
  project: ProjectState | null;
  selectedClipId: string | null;
  loading: boolean;
  error: string | null;
  previewDiff: TimelineDiff | null;

  fetchProject: () => Promise<void>;
  resetProject: () => Promise<void>;
  importAsset: (file: File) => Promise<void>;
  applyDiffToProject: (diff: TimelineDiff) => Promise<void>;
  applyDiffLocally: (diff: TimelineDiff) => void;
  setPreviewDiff: (diff: TimelineDiff | null) => void;
  selectClip: (clipId: string) => void;
  deselectAll: () => void;
  getAssetById: (assetId: string) => Asset | undefined;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  selectedClipId: null,
  loading: false,
  error: null,
  previewDiff: null,

  fetchProject: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/project");
      if (!res.ok) throw new Error("Failed to fetch project");
      const project = (await res.json()) as ProjectState;
      set({ project, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  resetProject: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/project/reset", { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset project");
      const project = (await res.json()) as ProjectState;
      set({ project, loading: false, selectedClipId: null, previewDiff: null });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  importAsset: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/assets/import", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to import asset");
      const asset = (await res.json()) as Asset;
      set((state) => {
        if (!state.project) return state;
        return {
          project: {
            ...state.project,
            assets: [...state.project.assets, asset],
          },
        };
      });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  applyDiffToProject: async (diff: TimelineDiff) => {
    try {
      const res = await fetch("/api/timeline/apply-diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(diff),
      });
      if (!res.ok) throw new Error("Failed to apply diff");
      const body = (await res.json()) as { state: ProjectState };
      set({ project: body.state, previewDiff: null });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  applyDiffLocally: (diff: TimelineDiff) => {
    const { project } = get();
    if (!project) return;
    const updated = applyDiff(project, diff);
    set({ project: updated });
  },

  setPreviewDiff: (diff: TimelineDiff | null) => {
    set({ previewDiff: diff });
  },

  selectClip: (clipId: string) => {
    set({ selectedClipId: clipId });
  },

  deselectAll: () => {
    set({ selectedClipId: null });
  },

  getAssetById: (assetId: string) => {
    return get().project?.assets.find((a) => a.id === assetId);
  },
}));
