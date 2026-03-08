import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Priority } from "@/types";

const PRIORITY_STYLES: Record<Priority, string> = {
  P0: "text-[var(--priority-p0)] bg-[var(--priority-p0-bg)] border-[var(--priority-p0-border)]",
  P1: "text-[var(--priority-p1)] bg-[var(--priority-p1-bg)] border-[var(--priority-p1-border)]",
  P2: "text-[var(--priority-p2)] bg-[var(--priority-p2-bg)] border-[var(--priority-p2-border)]",
  P3: "text-[var(--priority-p3)] bg-[var(--priority-p3-bg)] border-[var(--priority-p3-border)]",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  P0: "Urgent",
  P1: "High",
  P2: "Medium",
  P3: "Low",
};

interface PriorityIndicatorProps {
  priority: Priority;
  showLabel?: boolean;
  className?: string;
}

export function PriorityIndicator({
  priority,
  showLabel = true,
  className,
}: PriorityIndicatorProps) {
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] px-1.5 py-0", PRIORITY_STYLES[priority], className)}
    >
      {showLabel ? PRIORITY_LABELS[priority] : priority}
    </Badge>
  );
}
