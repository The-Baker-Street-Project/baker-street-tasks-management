import { Calendar } from "lucide-react";
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
      icon={<Calendar className="h-4 w-4 text-orange-500" />}
      emptyMessage="Nothing due today"
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
