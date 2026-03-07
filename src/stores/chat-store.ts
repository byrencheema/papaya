import { create } from "zustand";
import { v4 as uuid } from "uuid";
import type { ChatMessage, TimelineDiff } from "@shared/types";
import { useProjectStore } from "@/stores/project-store";

interface ChatStore {
  messages: ChatMessage[];
  activeDiff: TimelineDiff | null;
  previewSnapshot: string | null;
  appliedDiffIds: Set<string>;
  isStreaming: boolean;
  sendMessage: (text: string) => Promise<void>;
  previewDiff: (diff: TimelineDiff) => void;
  applyDiff: (diff: TimelineDiff) => Promise<void>;
  revertPreview: () => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  activeDiff: null,
  previewSnapshot: null,
  appliedDiffIds: new Set(),
  isStreaming: false,

  sendMessage: async (text: string) => {
    const projectStore = useProjectStore.getState();
    const projectId = projectStore.project?.id ?? "default";

    const userMsg: ChatMessage = {
      id: uuid(),
      role: "user",
      content: text,
      status: "done",
      createdAt: Date.now(),
    };

    const assistantMsg: ChatMessage = {
      id: uuid(),
      role: "assistant",
      content: "",
      status: "streaming",
      createdAt: Date.now(),
    };

    set((s) => ({
      messages: [...s.messages, userMsg, assistantMsg],
      isStreaming: true,
    }));

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          projectId,
          history: get()
            .messages.filter((m) => m.status === "done" && m.content)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to AI");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: { type: string; data: string };
          try {
            event = JSON.parse(raw) as { type: string; data: string };
          } catch {
            continue;
          }

          set((s) => {
            const msgs = [...s.messages];
            const last = msgs[msgs.length - 1];
            if (!last || last.role !== "assistant") return s;
            const updated = { ...last };

            switch (event.type) {
              case "plan":
                updated.plan = (updated.plan ?? "") + event.data;
                updated.content = updated.plan;
                break;
              case "status":
                updated.statusText = event.data;
                break;
              case "applied_diff": {
                const diff = JSON.parse(event.data) as TimelineDiff;
                updated.diff = diff;
                updated.statusText = undefined;
                const ids = new Set(s.appliedDiffIds);
                if (diff.id) ids.add(diff.id);
                msgs[msgs.length - 1] = updated;
                return { messages: msgs, appliedDiffIds: ids };
              }
              case "done":
                updated.status = "done";
                updated.statusText = undefined;
                useProjectStore.getState().fetchProject();
                break;
              case "error":
                updated.status = "error";
                updated.content = event.data;
                updated.statusText = undefined;
                break;
            }

            msgs[msgs.length - 1] = updated;
            return { messages: msgs };
          });
        }
      }

      set((s) => {
        const msgs = [...s.messages];
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant" && last.status === "streaming") {
          msgs[msgs.length - 1] = { ...last, status: "done" };
        }
        return { messages: msgs, isStreaming: false };
      });
    } catch (e) {
      set((s) => {
        const msgs = [...s.messages];
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant") {
          msgs[msgs.length - 1] = {
            ...last,
            status: "error",
            content: (e as Error).message,
          };
        }
        return { messages: msgs, isStreaming: false };
      });
    }
  },

  previewDiff: (diff: TimelineDiff) => {
    const projectStore = useProjectStore.getState();
    const snapshot = JSON.stringify(projectStore.project);
    set({ previewSnapshot: snapshot, activeDiff: diff });
    projectStore.applyDiffLocally(diff);
  },

  applyDiff: async (diff: TimelineDiff) => {
    const { previewSnapshot } = get();
    if (previewSnapshot) {
      const projectStore = useProjectStore.getState();
      projectStore.setPreviewDiff(null);
      const original = JSON.parse(previewSnapshot);
      useProjectStore.setState({ project: original });
    }
    const projectStore = useProjectStore.getState();
    await projectStore.applyDiffToProject(diff);
    set((s) => {
      const ids = new Set(s.appliedDiffIds);
      if (diff.id) ids.add(diff.id);
      return { activeDiff: null, previewSnapshot: null, appliedDiffIds: ids };
    });
  },

  revertPreview: () => {
    const { previewSnapshot } = get();
    if (previewSnapshot) {
      const original = JSON.parse(previewSnapshot);
      useProjectStore.setState({ project: original });
    }
    set({ activeDiff: null, previewSnapshot: null });
  },

  clearMessages: () => {
    set({ messages: [], activeDiff: null, previewSnapshot: null, appliedDiffIds: new Set() });
  },
}));
