"use client";

import { useState, useCallback, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { updateTask } from "@/lib/api/tasks";
import type { Task, TaskStatus } from "@/types";

interface KanbanBoardProps {
  tasks: Task[];
  onRefresh: () => void;
}

const COLUMNS: TaskStatus[] = ["Inbox", "Active", "Done"];

export function KanbanBoard({ tasks, onRefresh }: KanbanBoardProps) {
  const router = useRouter();
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isPending, startTransition] = useTransition();

  // Keep local tasks in sync with prop updates
  if (tasks !== localTasks && !activeTask) {
    setLocalTasks(tasks);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const tasksByStatus: Record<TaskStatus, Task[]> = {
    Inbox: [],
    Active: [],
    Someday: [],
    Done: [],
    Archived: [],
  };

  for (const task of localTasks) {
    if (tasksByStatus[task.status]) {
      tasksByStatus[task.status].push(task);
    }
  }

  // Sort each column by orderIndex
  for (const status of COLUMNS) {
    tasksByStatus[status].sort((a, b) =>
      a.orderIndex.localeCompare(b.orderIndex)
    );
  }

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const task = localTasks.find((t) => t.id === active.id);
      setActiveTask(task ?? null);
    },
    [localTasks]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Determine target column
      let targetStatus: TaskStatus | null = null;

      if (overId.startsWith("column-")) {
        targetStatus = overId.replace("column-", "") as TaskStatus;
      } else {
        // Hovering over another card -- get that card's status
        const overTask = localTasks.find((t) => t.id === overId);
        if (overTask) {
          targetStatus = overTask.status;
        }
      }

      if (!targetStatus) return;

      const activeTaskObj = localTasks.find((t) => t.id === activeId);
      if (!activeTaskObj || activeTaskObj.status === targetStatus) return;

      // Optimistically move the task to the new column
      setLocalTasks((prev) =>
        prev.map((t) =>
          t.id === activeId ? { ...t, status: targetStatus } : t
        )
      );
    },
    [localTasks]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Determine target column
      let targetStatus: TaskStatus | null = null;

      if (overId.startsWith("column-")) {
        targetStatus = overId.replace("column-", "") as TaskStatus;
      } else {
        const overTask = localTasks.find((t) => t.id === overId);
        if (overTask) {
          targetStatus = overTask.status;
        }
      }

      const movedTask = localTasks.find((t) => t.id === activeId);
      if (!movedTask || !targetStatus) return;

      // Calculate new order_index for within-column reordering
      const columnTasks = localTasks
        .filter((t) => t.status === targetStatus && t.id !== activeId)
        .sort((a, b) => a.orderIndex.localeCompare(b.orderIndex));

      let newOrderIndex: string;

      if (overId.startsWith("column-") || columnTasks.length === 0) {
        // Dropped on empty column or column header -- put at end
        const lastTask = columnTasks[columnTasks.length - 1];
        newOrderIndex = lastTask
          ? String.fromCharCode(lastTask.orderIndex.charCodeAt(0) + 1)
          : "m";
      } else {
        // Dropped on another card -- insert at that position
        const overIndex = columnTasks.findIndex((t) => t.id === overId);
        if (overIndex === 0) {
          // Before first card
          const firstOrder = columnTasks[0].orderIndex;
          newOrderIndex = firstOrder.slice(0, -1) +
            String.fromCharCode(firstOrder.charCodeAt(firstOrder.length - 1) - 1);
        } else if (overIndex === -1 || overIndex >= columnTasks.length) {
          // After last card
          const lastOrder = columnTasks[columnTasks.length - 1].orderIndex;
          newOrderIndex = lastOrder + "m";
        } else {
          // Between two cards
          const before = columnTasks[overIndex - 1].orderIndex;
          const after = columnTasks[overIndex].orderIndex;
          newOrderIndex = before + after.charAt(0);
        }
      }

      // Optimistically update local state
      setLocalTasks((prev) =>
        prev.map((t) =>
          t.id === activeId
            ? { ...t, status: targetStatus, orderIndex: newOrderIndex }
            : t
        )
      );

      // Persist the changes
      startTransition(async () => {
        try {
          await updateTask(activeId, {
            status: targetStatus,
            orderIndex: newOrderIndex,
          });
          onRefresh();
        } catch {
          toast.error("Failed to move task");
          onRefresh();
        }
      });
    },
    [localTasks, onRefresh]
  );

  const handleTaskClick = useCallback(
    (taskId: string) => {
      router.push(`/tasks?taskId=${taskId}`);
    },
    [router]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <h2 className="text-lg font-semibold">Kanban Board</h2>
        {isPending && (
          <span className="text-xs text-muted-foreground">Saving...</span>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full">
            {COLUMNS.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={tasksByStatus[status]}
                onTaskClick={handleTaskClick}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="rotate-3 opacity-90">
                <KanbanCard
                  task={activeTask}
                  onClick={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
