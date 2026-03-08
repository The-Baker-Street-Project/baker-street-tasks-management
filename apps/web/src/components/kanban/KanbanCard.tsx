"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Star,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDueDate } from "@/lib/utils/dates";
import { PriorityIndicator } from "@/components/shared/PriorityIndicator";
import { TagBadge } from "@/components/shared/TagBadge";
import type { Task } from "@/types";

interface KanbanCardProps {
  task: Task;
  onClick: () => void;
}

export function KanbanCard({ task, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "task",
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const subtasksDone = task.subtasks?.filter((s) => s.done).length ?? 0;
  const subtasksTotal = task.subtasks?.length ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground opacity-0 group-hover:opacity-100 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={onClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick();
            }
          }}
        >
          <div className="flex items-center gap-1.5">
            {task.isFocus && (
              <Star className="h-3 w-3 fill-[var(--focus-star)] text-[var(--focus-star)] shrink-0" />
            )}
            <span
              className={cn(
                "text-sm font-medium leading-tight",
                task.status === "Done" &&
                  "line-through text-muted-foreground"
              )}
            >
              {task.title}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <PriorityIndicator priority={task.priority} />

            {task.dueAt && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Calendar className="h-2.5 w-2.5" />
                {formatDueDate(task.dueAt)}
              </span>
            )}

            {subtasksTotal > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {subtasksDone}/{subtasksTotal}
              </span>
            )}
          </div>

          {task.tags && task.tags.length > 0 && (
            <div className="mt-1.5 flex gap-1 flex-wrap">
              {task.tags.slice(0, 3).map((tag) => (
                <TagBadge key={tag.id} tag={tag} />
              ))}
              {task.tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground">
                  +{task.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
