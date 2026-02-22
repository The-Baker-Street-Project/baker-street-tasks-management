import { Star } from "lucide-react";
import { DashboardBlock } from "./DashboardBlock";
import { TaskRow } from "@/components/shared/TaskRow";
import type { Task } from "@/types";

interface FocusBlockProps {
  tasks: Task[];
  onToggleComplete?: (taskId: string, done: boolean) => void;
}

export function FocusBlock({ tasks, onToggleComplete }: FocusBlockProps) {
  return (
    <DashboardBlock
      title="Focus 3"
      count={tasks.length}
      icon={<Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />}
      emptyMessage="No focused tasks"
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
