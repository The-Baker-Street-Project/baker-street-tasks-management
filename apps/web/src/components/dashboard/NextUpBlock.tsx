import { ListChecks } from "lucide-react";
import { DashboardBlock } from "./DashboardBlock";
import { TaskRow } from "@/components/shared/TaskRow";
import type { Task } from "@/types";

interface NextUpBlockProps {
  tasks: Task[];
  onToggleComplete?: (taskId: string, done: boolean) => void;
}

export function NextUpBlock({ tasks, onToggleComplete }: NextUpBlockProps) {
  return (
    <DashboardBlock
      title="Next Up"
      count={tasks.length}
      viewAllHref="/tasks?view=active"
      icon={<ListChecks className="h-4 w-4 text-blue-500" />}
      emptyMessage="No active tasks"
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
