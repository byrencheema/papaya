import { create } from "zustand";
import { compositionManager } from "@/lib/composition-manager";

interface PlaybackStore {
  playing: boolean;
  currentTimeMs: number;

  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  seek: (ms: number) => void;
}

export const usePlaybackStore = create<PlaybackStore>((set) => ({
  playing: false,
  currentTimeMs: 0,

  play: () => {
    compositionManager.play();
    set({ playing: true });
  },
  pause: () => {
    compositionManager.pause();
    set({ playing: false });
  },
  togglePlayback: () =>
    set((s) => {
      if (s.playing) {
        compositionManager.pause();
      } else {
        compositionManager.play();
      }
      return { playing: !s.playing };
    }),
  seek: (ms) => {
    compositionManager.seek(ms);
    set({ currentTimeMs: Math.max(0, ms) });
  },
}));
