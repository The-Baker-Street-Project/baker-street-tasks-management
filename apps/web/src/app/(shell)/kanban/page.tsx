import { getTasks } from "@/lib/api/tasks";
import { KanbanPageClient } from "./kanban-page-client";

export default async function KanbanPage() {
  const tasks = await getTasks();

  return <KanbanPageClient initialTasks={tasks} />;
}
