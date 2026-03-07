import { useToastStore } from "@/stores/toast-store";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto border-2 px-4 py-3 text-xs font-mono font-semibold uppercase tracking-wide shadow-[var(--shadow-2)] animate-in slide-in-from-bottom-2 fade-in",
            toast.variant === "error" && "bg-destructive text-destructive-foreground border-destructive",
            toast.variant === "success" && "bg-success text-success-foreground border-success",
            toast.variant === "default" && "bg-surface-highest text-foreground border-outline-variant",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <span>{toast.message}</span>
            <button
              className="opacity-70 hover:opacity-100 transition-opacity"
              onClick={() => removeToast(toast.id)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
