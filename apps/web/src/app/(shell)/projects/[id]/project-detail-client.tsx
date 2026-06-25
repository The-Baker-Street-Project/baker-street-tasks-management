"use client";

import { useState, useCallback, useTransition } from "react";
import { useQueryState } from "nuqs";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskDetail } from "@/components/tasks/TaskDetail";
import { TaskCreateDialog } from "@/components/tasks/TaskCreateDialog";
import { getTasks, getTask } from "@/lib/api/tasks";
import type { Task, Tag, Project, ProjectTreeNode } from "@/types";

interface ProjectDetailClientProps {
  project: Project;
  progress: { done: number; total: number };
  initialTasks: Task[];
  projectTree: ProjectTreeNode[];
  allTags: Tag[];
}

export function ProjectDetailClient({
  project,
  progress,
  initialTasks,
  projectTree,
  allTags,
}: ProjectDetailClientProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useQueryState("taskId");
  const [isPending, startTransition] = useTransition();

  const refreshTasks = useCallback(() => {
    startTransition(async () => {
      try {
        const updated = await getTasks({ projectId: project.id });
        setTasks(updated);
      } catch {
        // silently fail
      }
    });
  }, [project.id]);

  const handleTaskSelect = useCallback(async (taskId: string | null) => {
    if (!taskId) {
      setSelectedTask(null);
      return;
    }
    try {
      const task = await getTask(taskId);
      setSelectedTask(task);
    } catch {
      setSelectedTask(null);
    }
  }, []);

  const currentTask =
    selectedTaskId && selectedTask?.id === selectedTaskId
      ? selectedTask
      : null;

  if (selectedTaskId && !currentTask && !isPending) {
    handleTaskSelect(selectedTaskId);
  }

  const progressPct =
    progress.total > 0 ? (progress.done / progress.total) * 100 : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Project header */}
      <div className="border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          {project.color && (
            <span
              className="inline-block h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: project.color }}
            />
          )}
          <h1 className="text-xl font-semibold">{project.name}</h1>
        </div>
        {project.description && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {project.description}
          </p>
        )}
        <div className="mt-2">
          {progress.total === 0 ? (
            <span className="text-xs text-muted-foreground">No tasks</span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {progress.done}/{progress.total}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Three-pane body */}
      <div className="flex flex-1 min-h-0">
        {/* Task list */}
        <div className="flex-1 min-w-0">
          <TaskList
            tasks={tasks}
            title={project.name}
            isLoading={isPending}
            onCreateClick={() => setShowCreateDialog(true)}
            onRefresh={refreshTasks}
          />
        </div>

        {/* Task detail panel */}
        {currentTask && (
          <div
            key={currentTask.id}
            className="hidden md:block motion-safe:animate-slide-in-right"
          >
            <TaskDetail
              task={currentTask}
              allTags={allTags}
              projectTree={projectTree}
              onClose={() => {
                setSelectedTaskId(null);
                setSelectedTask(null);
              }}
              onRefresh={() => {
                refreshTasks();
                if (selectedTaskId) {
                  handleTaskSelect(selectedTaskId);
                }
              }}
            />
          </div>
        )}
      </div>

      <TaskCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={refreshTasks}
      />
    </div>
  );
}
