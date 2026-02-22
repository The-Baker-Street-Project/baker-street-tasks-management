import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDueDate, isOverdue, isDueToday } from "@/lib/utils/dates";

interface DueDateDisplayProps {
  date: Date;
  className?: string;
}

export function DueDateDisplay({ date, className }: DueDateDisplayProps) {
  const overdue = isOverdue(date);
  const today = isDueToday(date);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        overdue && "font-medium text-red-600 dark:text-red-400",
        today && !overdue && "font-medium text-orange-600 dark:text-orange-400",
        !overdue && !today && "text-muted-foreground",
        className
      )}
    >
      <Calendar className="h-3 w-3" />
      {formatDueDate(date)}
    </span>
  );
}
