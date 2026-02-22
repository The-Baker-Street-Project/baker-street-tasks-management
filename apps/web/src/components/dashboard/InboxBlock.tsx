import { Inbox } from "lucide-react";
import { DashboardBlock } from "./DashboardBlock";
import { TaskRow } from "@/components/shared/TaskRow";
import type { Task } from "@/types";

interface InboxBlockProps {
  tasks: Task[];
  onToggleComplete?: (taskId: string, done: boolean) => void;
}

export function InboxBlock({ tasks, onToggleComplete }: InboxBlockProps) {
  return (
    <DashboardBlock
      title="Inbox"
      count={tasks.length}
      viewAllHref="/tasks?view=inbox"
      icon={<Inbox className="h-4 w-4 text-gray-500" />}
      emptyMessage="Inbox is empty"
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
