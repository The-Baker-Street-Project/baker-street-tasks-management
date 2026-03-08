"use client";

import { useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { OverdueBlock } from "@/components/dashboard/OverdueBlock";
import { DueTodayBlock } from "@/components/dashboard/DueTodayBlock";
import { NextUpBlock } from "@/components/dashboard/NextUpBlock";
import { HighPriorityBlock } from "@/components/dashboard/HighPriorityBlock";
import { InboxBlock } from "@/components/dashboard/InboxBlock";
import { FocusBlock } from "@/components/dashboard/FocusBlock";
import { toast } from "sonner";
import { completeTask, reopenTask } from "@/lib/api/tasks";
import type { Task } from "@/types";

interface DashboardClientProps {
  overdue: Task[];
  dueToday: Task[];
  nextUp: Task[];
  highPriority: Task[];
  inbox: Task[];
  focus: Task[];
}

export function DashboardClient({
  overdue,
  dueToday,
  nextUp,
  highPriority,
  inbox,
  focus,
}: DashboardClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const handleToggleComplete = useCallback(
    (taskId: string, done: boolean) => {
      startTransition(async () => {
        try {
          if (done) {
            await completeTask(taskId);
          } else {
            await reopenTask(taskId);
          }
          router.refresh();
        } catch {
          toast.error("Failed to update task");
        }
      });
    },
    [router]
  );

  return (
    <DashboardGrid>
      <OverdueBlock tasks={overdue} onToggleComplete={handleToggleComplete} />
      <DueTodayBlock tasks={dueToday} onToggleComplete={handleToggleComplete} />
      <FocusBlock tasks={focus} onToggleComplete={handleToggleComplete} />
      <NextUpBlock tasks={nextUp} onToggleComplete={handleToggleComplete} />
      <HighPriorityBlock tasks={highPriority} onToggleComplete={handleToggleComplete} />
      <InboxBlock tasks={inbox} onToggleComplete={handleToggleComplete} />
    </DashboardGrid>
  );
}
