import { Calendar, CheckCircle2 } from "lucide-react";
import { DashboardBlock } from "./DashboardBlock";
import { TaskRow } from "@/components/shared/TaskRow";
import type { Task } from "@/types";

interface DueTodayBlockProps {
  tasks: Task[];
  onToggleComplete?: (taskId: string, done: boolean) => void;
}

export function DueTodayBlock({ tasks, onToggleComplete }: DueTodayBlockProps) {
  return (
    <DashboardBlock
      title="Due Today"
      count={tasks.length}
      viewAllHref="/tasks?view=all&sort=due_date"
      icon={<Calendar className="h-4 w-4 text-[var(--date-today)]" />}
      emptyMessage="Nothing due today — you're ahead!"
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
