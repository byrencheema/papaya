import { useState, type FormEvent } from "react";
import { useChatStore } from "@/stores/chat-store";
import { ArrowUp } from "lucide-react";

export function ChatInput() {
  const [text, setText] = useState("");
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    setText("");
    sendMessage(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="p-3">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-high px-3 py-2 focus-within:border-outline transition-colors duration-150">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe your edit..."
          disabled={isStreaming}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !text.trim()}
          className="h-6 w-6 shrink-0 flex items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-30 hover:bg-primary/90 active:bg-primary/80 transition-colors duration-100"
        >
          <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </form>
  );
}
