import { getTasks } from "@/lib/api/tasks";
import { getSavedViews, getTags } from "@/lib/api/views";
import { getProjectsTree } from "@/lib/api/projects";
import { TasksPageClient } from "./tasks-page-client";

export default async function TasksPage() {
  const [tasks, savedViews, tags, projectTree] = await Promise.all([
    getTasks(),
    getSavedViews("Tasks"),
    getTags(),
    getProjectsTree(),
  ]);

  return (
    <TasksPageClient
      initialTasks={tasks}
      savedViews={savedViews}
      tags={tags}
      projectTree={projectTree}
    />
  );
}
