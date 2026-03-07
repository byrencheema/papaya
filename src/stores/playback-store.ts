import { create } from "zustand";

interface PlaybackStore {
  playing: boolean;
  currentTimeMs: number;

  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  seek: (ms: number) => void;
  tick: (deltaMs: number) => void;
}

export const usePlaybackStore = create<PlaybackStore>((set, get) => ({
  playing: false,
  currentTimeMs: 0,

  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  togglePlayback: () => set((s) => ({ playing: !s.playing })),
  seek: (ms) => set({ currentTimeMs: Math.max(0, ms) }),
  tick: (deltaMs) => {
    const { currentTimeMs } = get();
    set({ currentTimeMs: currentTimeMs + deltaMs });
  },
}));
