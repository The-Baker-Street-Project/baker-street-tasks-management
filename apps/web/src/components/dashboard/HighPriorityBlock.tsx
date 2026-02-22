import { Flame } from "lucide-react";
import { DashboardBlock } from "./DashboardBlock";
import { TaskRow } from "@/components/shared/TaskRow";
import type { Task } from "@/types";

interface HighPriorityBlockProps {
  tasks: Task[];
  onToggleComplete?: (taskId: string, done: boolean) => void;
}

export function HighPriorityBlock({ tasks, onToggleComplete }: HighPriorityBlockProps) {
  return (
    <DashboardBlock
      title="High Priority"
      count={tasks.length}
      viewAllHref="/tasks?view=all&sort=priority"
      icon={<Flame className="h-4 w-4 text-orange-500" />}
      emptyMessage="No high priority tasks"
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
