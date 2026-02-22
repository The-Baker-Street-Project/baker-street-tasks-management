"use client";

import { KanbanColumn } from "./KanbanColumn";
import type { Task, TaskStatus } from "@/types";

interface KanbanSwimLaneProps {
  label: string;
  tasks: Task[];
  columns: TaskStatus[];
  onTaskClick: (taskId: string) => void;
}

export function KanbanSwimLane({
  label,
  tasks,
  columns,
  onTaskClick,
}: KanbanSwimLaneProps) {
  const tasksByStatus = columns.reduce<Record<TaskStatus, Task[]>>(
    (acc, status) => {
      acc[status] = tasks.filter((t) => t.status === status);
      return acc;
    },
    {} as Record<TaskStatus, Task[]>
  );

  return (
    <div className="space-y-2">
      <h3 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status] ?? []}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
    </div>
  );
}
