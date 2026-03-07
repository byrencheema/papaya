import type { ChatMessage as ChatMessageType } from "@shared/types";
import { PlanCard } from "./PlanCard";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: ChatMessageType;
}

function cleanContent(raw: string, hasDiff: boolean): string | null {
  if (!raw) return null;
  if (hasDiff) {
    const lines = raw.split("\n");
    const meaningful: string[] = [];
    let inCodeBlock = false;
    for (const line of lines) {
      if (line.trim().startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;
      if (line.includes("clipId") || line.includes("trackCount") || line.includes("atMs")) continue;
      if (line.includes("functionCall") || line.includes("functionResponse")) continue;
      if (/^\s*[\[{]/.test(line) && (line.includes('"type"') || line.includes('"id"'))) continue;
      if (/bytes\)/.test(line)) continue;
      if (/^\s*(Wait|Actually|Let me|I'll |I will |I don't |I should |I am |Let's |End\.|All good)/.test(line.trim())) continue;
      if (line.trim().startsWith('"') && line.trim().endsWith('"')) continue;
      meaningful.push(line);
    }
    const cleaned = meaningful.join("\n").trim();
    const sentences = cleaned.split(/(?<=[.!])\s+/);
    const summary = sentences
      .filter((s) => s.length > 10 && !s.includes("{") && !s.includes("clipId"))
      .slice(0, 3)
      .join(" ");
    return summary || null;
  }
  let cleaned = raw;
  cleaned = cleaned.replace(/```[\s\S]*?```/g, "");
  cleaned = cleaned.replace(/\{[\s\S]*?"type"[\s\S]*?\}/g, "");
  cleaned = cleaned.replace(/\([\d,]+ bytes\)/g, "");
  cleaned = cleaned.replace(/<ctrl\d+>/g, "");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  return cleaned.trim() || null;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const hasDiff = !!message.diff;
  const displayContent = isUser
    ? message.content
    : cleanContent(message.content, hasDiff);

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-surface text-foreground rounded-bl-md"
        )}
      >
        {message.status === "streaming" && !message.content && !message.statusText && (
          <div className="flex items-center gap-1.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
          </div>
        )}
        {displayContent && (
          <p className="whitespace-pre-wrap">{displayContent}</p>
        )}
        {message.statusText && (
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            <div className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-primary border-t-transparent" />
            {message.statusText}
          </div>
        )}
        {message.status === "error" && (
          <p className="text-destructive text-xs mt-1.5">Error occurred</p>
        )}
        {message.diff && (
          <PlanCard plan={message.plan} diff={message.diff} />
        )}
      </div>
    </div>
  );
}
