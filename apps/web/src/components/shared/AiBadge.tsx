import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiBadgeProps {
  className?: string;
}

export function AiBadge({ className }: AiBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-[var(--ai-badge-bg)] px-1.5 py-0 text-[10px] font-medium text-[var(--ai-badge)]",
        className
      )}
    >
      <Bot className="h-2.5 w-2.5" />
      AI
    </span>
  );
}
