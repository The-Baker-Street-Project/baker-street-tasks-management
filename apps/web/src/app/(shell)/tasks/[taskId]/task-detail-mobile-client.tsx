"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TaskDetail } from "@/components/tasks/TaskDetail";
import { getTask } from "@/lib/api/tasks";
import type { Task } from "@/types";

interface TaskDetailMobileClientProps {
  initialTask: Task;
}

export function TaskDetailMobileClient({
  initialTask,
}: TaskDetailMobileClientProps) {
  const router = useRouter();
  const [task, setTask] = useState(initialTask);

  const handleRefresh = useCallback(async () => {
    try {
      const updated = await getTask(task.id);
      if (updated) {
        setTask(updated);
      }
    } catch {
      toast.error("Failed to load task");
    }
  }, [task.id]);

  return (
    <div className="flex h-full flex-col">
      {/* Mobile back header */}
      <div className="flex items-center gap-2 border-b px-4 py-2 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/tasks")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">Back to Tasks</span>
      </div>

      {/* Task detail rendered full-width on mobile */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full [&>div]:w-full [&>div]:border-l-0">
          <TaskDetail
            task={task}
            onClose={() => router.push("/tasks")}
            onRefresh={handleRefresh}
          />
        </div>
      </div>
    </div>
  );
}
