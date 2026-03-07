import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
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
      <div className="flex items-center gap-2 rounded-full bg-surface-highest pl-4 pr-1.5 py-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe your edit..."
          disabled={isStreaming}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50"
        />
        <Button
          type="submit"
          size="icon"
          disabled={isStreaming || !text.trim()}
          className="h-8 w-8 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-30"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
