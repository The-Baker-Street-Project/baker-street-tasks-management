import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiBadgeProps {
  className?: string;
}

export function AiBadge({ className }: AiBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0 text-[10px] font-medium text-violet-700 dark:bg-violet-900 dark:text-violet-300",
        className
      )}
    >
      <Bot className="h-2.5 w-2.5" />
      AI
    </span>
  );
}
