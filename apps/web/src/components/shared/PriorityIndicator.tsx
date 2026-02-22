import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Priority } from "@/types";

const PRIORITY_STYLES: Record<Priority, string> = {
  P0: "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800",
  P1: "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-800",
  P2: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800",
  P3: "text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-900 dark:border-gray-800",
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
