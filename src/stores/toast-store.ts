import { create } from "zustand";

export interface Toast {
  id: string;
  message: string;
  variant: "default" | "error" | "success";
  createdAt: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, variant?: Toast["variant"]) => void;
  removeToast: (id: string) => void;
}

let nextId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (message, variant = "default") => {
    const id = String(++nextId);
    const toast: Toast = { id, message, variant, createdAt: Date.now() };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
