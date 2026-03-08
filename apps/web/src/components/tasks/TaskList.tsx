"use client";

import { useRef, useCallback, useMemo, useTransition } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueryState } from "nuqs";
import { completeTask, reopenTask } from "@/lib/api/tasks";
import {
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { TaskRow as SharedTaskRow } from "@/components/shared/TaskRow";
import { comparePriority } from "@/lib/utils/priorities";
import type { Task } from "@/types";

interface TaskListProps {
  tasks: Task[];
  title: string;
  isLoading?: boolean;
  onCreateClick: () => void;
  onRefresh?: () => void;
}

type SortOption = "due_date" | "priority" | "created" | "order";

const SORT_LABELS: Record<SortOption, string> = {
  due_date: "Due Date",
  priority: "Priority",
  created: "Created",
  order: "Manual Order",
};

function TaskRowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 animate-pulse">
      <div className="h-4 w-4 rounded bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="rounded-full bg-muted p-4">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">No tasks found</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Create a new task to get started.
      </p>
    </div>
  );
}

export function TaskList({
  tasks,
  title,
  isLoading = false,
  onCreateClick,
  onRefresh,
}: TaskListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [selectedTaskId, setSelectedTaskId] = useQueryState("taskId");
  const [sort, setSort] = useQueryState("sort", {
    defaultValue: "order" as SortOption,
  });

  const sortedTasks = useMemo(() => {
    const sorted = [...tasks];
    switch (sort) {
      case "due_date":
        sorted.sort((a, b) => {
          if (!a.dueAt && !b.dueAt) return 0;
          if (!a.dueAt) return 1;
          if (!b.dueAt) return -1;
          return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        });
        break;
      case "priority":
        sorted.sort((a, b) => comparePriority(a.priority, b.priority));
        break;
      case "created":
        sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case "order":
      default:
        sorted.sort((a, b) => a.orderIndex.localeCompare(b.orderIndex));
        break;
    }
    return sorted;
  }, [tasks, sort]);

  const virtualizer = useVirtualizer({
    count: sortedTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  const handleTaskClick = useCallback(
    (taskId: string) => {
      setSelectedTaskId(taskId);
    },
    [setSelectedTaskId]
  );

  const [, startToggle] = useTransition();

  const handleToggleComplete = useCallback(
    (taskId: string, done: boolean) => {
      startToggle(async () => {
        try {
          if (done) {
            await completeTask(taskId);
          } else {
            await reopenTask(taskId);
          }
          onRefresh?.();
        } catch {
          toast.error("Failed to update task");
        }
      });
    },
    [onRefresh]
  );

  return (
    <div className="flex h-full min-w-80 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Sort: {SORT_LABELS[sort as SortOption] ?? "Manual Order"}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(
                Object.entries(SORT_LABELS) as [SortOption, string][]
              ).map(([value, label]) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => setSort(value)}
                  className={cn(
                    "cursor-pointer",
                    sort === value && "font-semibold"
                  )}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={onCreateClick}>
            + New
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div>
          {Array.from({ length: 5 }).map((_, i) => (
            <TaskRowSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sortedTasks.length === 0 && <EmptyState />}

      {/* Virtualized list */}
      {!isLoading && sortedTasks.length > 0 && (
        <div ref={parentRef} className="flex-1 overflow-auto">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const task = sortedTasks[virtualRow.index];
              return (
                <div
                  key={task.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleTaskClick(task.id)}
                    className={cn(
                      "w-full border-b transition-colors",
                      selectedTaskId === task.id
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <SharedTaskRow
                      task={task}
                      showCheckbox
                      onToggleComplete={handleToggleComplete}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
