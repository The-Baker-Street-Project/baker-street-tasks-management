import { getTasks } from "@/lib/api/tasks";
import { getSavedViews, getTags } from "@/lib/api/views";
import { TasksPageClient } from "./tasks-page-client";

export default async function TasksPage() {
  const [tasks, savedViews, tags] = await Promise.all([
    getTasks(),
    getSavedViews("Tasks"),
    getTags(),
  ]);

  return (
    <TasksPageClient
      initialTasks={tasks}
      savedViews={savedViews}
      tags={tags}
    />
  );
}
