import { getTasks } from "@/lib/api/tasks";
import { getSavedViews, getTags } from "@/lib/api/views";
import { listProjects } from "@/lib/api/projects";
import { TasksPageClient } from "./tasks-page-client";

export default async function TasksPage() {
  const [tasks, savedViews, tags, projects] = await Promise.all([
    getTasks(),
    getSavedViews("Tasks"),
    getTags(),
    listProjects(),
  ]);

  return (
    <TasksPageClient
      initialTasks={tasks}
      savedViews={savedViews}
      tags={tags}
      projects={projects}
    />
  );
}
