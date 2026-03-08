import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "@/types";

const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  Inbox: "text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-800",
  Active: "text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900",
  Someday: "text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-900",
  Done: "text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900",
  Archived: "text-gray-500 bg-gray-50 dark:text-gray-500 dark:bg-gray-900",
};

interface StatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles = TASK_STATUS_STYLES[status];

  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", styles, className)}>
      {status}
    </Badge>
  );
}
