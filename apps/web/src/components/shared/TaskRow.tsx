"use client";

import Link from "next/link";
import { Star, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PriorityIndicator } from "./PriorityIndicator";
import { DueDateDisplay } from "./DueDateDisplay";
import { SubtaskProgress } from "./SubtaskProgress";
import { TagBadge } from "./TagBadge";
import { AiBadge } from "./AiBadge";
import type { Task } from "@/types";

interface TaskRowProps {
  task: Task;
  compact?: boolean;
  showCheckbox?: boolean;
  onToggleComplete?: (taskId: string, done: boolean) => void;
  href?: string;
}

export function TaskRow({
  task,
  compact = false,
  showCheckbox = false,
  onToggleComplete,
  href,
}: TaskRowProps) {
  const isDone = task.status === "Done";
  const subtasksDone = task.subtasks?.filter((s) => s.done).length ?? 0;
  const subtasksTotal = task.subtasks?.length ?? 0;

  const content = (
    <div
      className={cn(
        "flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/50",
        compact && "py-1.5"
      )}
    >
      {showCheckbox && (
        <div className="pt-0.5">
          <Checkbox
            checked={isDone}
            onCheckedChange={(checked) =>
              onToggleComplete?.(task.id, Boolean(checked))
            }
          />
        </div>
      )}

      <div className="flex flex-1 min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          {task.isFocus && (
            <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-400" />
          )}
          <span
            className={cn(
              "truncate text-sm font-medium",
              isDone && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </span>
          {task.createdBy === "mcp" && <AiBadge />}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {task.priority && <PriorityIndicator priority={task.priority} />}
          {task.dueAt && <DueDateDisplay date={task.dueAt} />}
          {task.context && (
            <span className="text-xs text-muted-foreground">{task.context}</span>
          )}
          {subtasksTotal > 0 && (
            <SubtaskProgress done={subtasksDone} total={subtasksTotal} />
          )}
          {task.tags && task.tags.length > 0 && (
            <div className="flex gap-1">
              {task.tags.slice(0, 2).map((tag) => (
                <TagBadge key={tag.id} tag={tag} />
              ))}
              {task.tags.length > 2 && (
                <span className="text-[10px] text-muted-foreground">
                  +{task.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
