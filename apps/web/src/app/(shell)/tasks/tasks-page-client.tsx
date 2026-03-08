"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { useQueryState } from "nuqs";
import { TaskSidebar } from "@/components/tasks/TaskSidebar";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskDetail } from "@/components/tasks/TaskDetail";
import { TaskCreateDialog } from "@/components/tasks/TaskCreateDialog";
import { getTasks, getTask } from "@/lib/api/tasks";
import type { Task, SavedView, Tag, Context } from "@/types";

const VALID_CONTEXTS = ["Home", "Work"] as const;

interface TasksPageClientProps {
  initialTasks: Task[];
  savedViews: SavedView[];
  tags: Tag[];
}

export function TasksPageClient({
  initialTasks,
  savedViews,
  tags,
}: TasksPageClientProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useQueryState("taskId");
  const [selectedView] = useQueryState("view", { defaultValue: "all" });
  const [selectedTag] = useQueryState("tag");
  const [contextParam] = useQueryState("context");
  const [isPending, startTransition] = useTransition();

  const viewTitle = (() => {
    if (selectedTag) {
      const tag = tags.find((t) => t.id === selectedTag);
      return tag ? `Tag: ${tag.name}` : "Tagged Tasks";
    }
    const view = savedViews.find((v) => v.id === selectedView);
    if (view) return view.name;
    const nameMap: Record<string, string> = {
      all: "All Tasks",
      inbox: "Inbox",
      active: "Active",
    };
    return nameMap[selectedView] ?? "All Tasks";
  })();

  const refreshTasks = useCallback(() => {
    startTransition(async () => {
      try {
        const context = contextParam && VALID_CONTEXTS.includes(contextParam as typeof VALID_CONTEXTS[number])
          ? (contextParam as Context)
          : undefined;
        const updated = await getTasks({
          view: selectedView ?? undefined,
          tagId: selectedTag ?? undefined,
          context: context ?? undefined,
        });
        setTasks(updated);
      } catch {
        // silently fail
      }
    });
  }, [selectedView, selectedTag, contextParam]);

  const handleTaskSelect = useCallback(
    async (taskId: string | null) => {
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
    },
    []
  );

  // When selectedTaskId changes via URL, fetch the task detail
  const currentTask =
    selectedTaskId && selectedTask?.id === selectedTaskId
      ? selectedTask
      : null;

  if (selectedTaskId && !currentTask && !isPending) {
    handleTaskSelect(selectedTaskId);
  }

  useEffect(() => {
    refreshTasks();
  }, [selectedView, selectedTag, contextParam, refreshTasks]);

  return (
    <div className="flex h-full">
      {/* Left sidebar - hidden on mobile */}
      <div className="hidden lg:block">
        <TaskSidebar savedViews={savedViews} tags={tags} />
      </div>

      {/* Middle list */}
      <div className="flex-1 min-w-0">
        <TaskList
          tasks={tasks}
          title={viewTitle}
          isLoading={isPending}
          onCreateClick={() => setShowCreateDialog(true)}
          onRefresh={refreshTasks}
        />
      </div>

      {/* Right detail */}
      {currentTask && (
        <div
          key={currentTask.id}
          className="hidden md:block motion-safe:animate-slide-in-right"
        >
          <TaskDetail
            task={currentTask}
            allTags={tags}
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

      <TaskCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={refreshTasks}
      />
    </div>
  );
}
