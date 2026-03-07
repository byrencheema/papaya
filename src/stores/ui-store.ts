import { create } from "zustand";

interface UIStore {
  zoom: number;
  scrollLeft: number;
  timelinePanelHeight: number;
  binPanelWidth: number;
  chatPanelWidth: number;

  setZoom: (zoom: number) => void;
  setScrollLeft: (scrollLeft: number) => void;
  setTimelinePanelHeight: (height: number) => void;
  setBinPanelWidth: (width: number) => void;
  setChatPanelWidth: (width: number) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  zoom: 0.1,
  scrollLeft: 0,
  timelinePanelHeight: 200,
  binPanelWidth: 250,
  chatPanelWidth: 350,

  setZoom: (zoom) => set({ zoom: Math.max(0.01, Math.min(1, zoom)) }),
  setScrollLeft: (scrollLeft) => set({ scrollLeft }),
  setTimelinePanelHeight: (height) => set({ timelinePanelHeight: height }),
  setBinPanelWidth: (width) => set({ binPanelWidth: width }),
  setChatPanelWidth: (width) => set({ chatPanelWidth: width }),
}));
