import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatStore } from "@/stores/chat-store";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { MessageSquare } from "lucide-react";

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-4 py-3 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">AI Assistant</h2>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-3 px-4 pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 mt-12 px-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
                Describe changes to your timeline and the AI will generate a plan.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {["Add captions", "Trim highlights", "Add music"].map((suggestion) => (
                  <button
                    key={suggestion}
                    className="rounded-full border border-outline-variant px-3 py-1.5 text-xs text-on-surface-variant hover:bg-surface-high transition-colors duration-150"
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
      <div className="shrink-0">
        <ChatInput />
      </div>
    </div>
  );
}
