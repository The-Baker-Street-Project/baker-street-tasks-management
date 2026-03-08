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
        overdue && "font-medium text-[var(--date-overdue)]",
        today && !overdue && "font-medium text-[var(--date-today)]",
        !overdue && !today && "text-muted-foreground",
        className
      )}
    >
      <Calendar className="h-3 w-3" />
      {formatDueDate(date)}
    </span>
  );
}
