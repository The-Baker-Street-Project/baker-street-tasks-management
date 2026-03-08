"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { KanbanCard } from "./KanbanCard";
import type { Task, TaskStatus } from "@/types";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
}

const COLUMN_STYLES: Record<string, string> = {
  Inbox: "border-t-[var(--status-inbox)]",
  Active: "border-t-[var(--status-active)]",
  Someday: "border-t-[var(--status-someday)]",
  Done: "border-t-[var(--status-done)]",
};

export function KanbanColumn({
  status,
  tasks,
  onTaskClick,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: {
      type: "column",
      status,
    },
  });

  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      className={cn(
        "flex w-80 shrink-0 flex-col rounded-lg border border-t-4 bg-muted/30",
        COLUMN_STYLES[status] ?? "border-t-gray-300",
        isOver && "ring-2 ring-primary ring-offset-2"
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{status}</h3>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto px-2 pb-2"
      >
        <SortableContext
          items={taskIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {tasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task.id)}
              />
            ))}
          </div>
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-6 text-center">
            <p className="text-xs font-medium text-muted-foreground">
              No {status.toLowerCase()} tasks
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              Drag tasks here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
