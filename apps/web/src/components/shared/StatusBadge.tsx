import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "@/types";

const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  Inbox: "text-[var(--status-inbox)] bg-[var(--status-inbox-bg)]",
  Active: "text-[var(--status-active)] bg-[var(--status-active-bg)]",
  Someday: "text-[var(--status-someday)] bg-[var(--status-someday-bg)]",
  Done: "text-[var(--status-done)] bg-[var(--status-done-bg)]",
  Archived: "text-[var(--status-archived)] bg-[var(--status-archived-bg)]",
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
