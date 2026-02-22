"use client";

import { useState, useCallback, useTransition } from "react";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { getTasks } from "@/lib/api/tasks";
import type { Task } from "@/types";

interface KanbanPageClientProps {
  initialTasks: Task[];
}

export function KanbanPageClient({
  initialTasks,
}: KanbanPageClientProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [, startTransition] = useTransition();

  const refreshTasks = useCallback(() => {
    startTransition(async () => {
      try {
        const updated = await getTasks();
        setTasks(updated);
      } catch {
        // Server action not yet implemented
      }
    });
  }, []);

  return (
    <KanbanBoard
      tasks={tasks}
      onRefresh={refreshTasks}
    />
  );
}
