import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { DashboardBlock } from "./DashboardBlock";
import { TaskRow } from "@/components/shared/TaskRow";
import type { Task } from "@/types";

interface OverdueBlockProps {
  tasks: Task[];
  onToggleComplete?: (taskId: string, done: boolean) => void;
}

export function OverdueBlock({ tasks, onToggleComplete }: OverdueBlockProps) {
  return (
    <DashboardBlock
      title="Overdue"
      count={tasks.length}
      viewAllHref="/tasks?view=all&sort=due_date"
      icon={<AlertTriangle className="h-4 w-4 text-[var(--date-overdue)]" />}
      emptyMessage="All caught up!"
      emptyIcon={<CheckCircle2 className="h-8 w-8 text-[var(--status-done)]" />}
    >
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          compact
          href={`/tasks?taskId=${task.id}`}
          showCheckbox={!!onToggleComplete}
          onToggleComplete={onToggleComplete}
        />
      ))}
    </DashboardBlock>
  );
}
