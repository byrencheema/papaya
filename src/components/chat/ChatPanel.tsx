import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatStore } from "@/stores/chat-store";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b border-border">
        <h2 className="text-xs font-semibold text-muted-foreground tracking-wide">papaya ai</h2>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden relative">
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-3 px-4 py-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-4 text-center" style={{ marginTop: "55%" }}>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-primary text-base font-semibold leading-none">p</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Describe changes to your timeline.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {["Add captions", "Trim highlights", "Add music"].map((suggestion) => (
                  <button
                    key={suggestion}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-high hover:text-foreground hover:border-outline transition-colors duration-150"
                    onClick={() => {
                      const { sendMessage, isStreaming } = useChatStore.getState();
                      if (!isStreaming) sendMessage(suggestion);
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      </div>
      <div className="shrink-0">
        <ChatInput />
      </div>
    </div>
  );
}
